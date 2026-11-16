import threading
from pathlib import Path
import cv2
import numpy as np
from django.conf import settings

LABELS = ['Enojo', 'Disgusto', 'Miedo', 'Alegría', 'Neutral', 'Tristeza', 'Sorpresa']

class EmotionService:
    def __init__(self):
        self.lock = threading.RLock()
        self.network = None

    def load(self):
        if self.network is not None:
            return
        # Keep CPU inference from competing across worker threads on local PCs.
        cv2.setNumThreads(getattr(settings, 'OPENCV_NUM_THREADS', 1))
        root = Path(settings.BASE_DIR) / 'data' / 'models'
        detector = root / 'face_detection_yunet_2023mar.onnx'
        emotion = root / 'facial_expression_recognition_mobilefacenet_2022july.onnx'
        if not detector.exists() or not emotion.exists():
            raise RuntimeError('Faltan los modelos. Ejecuta: python scripts/download_models.py')
        model = np.frombuffer(detector.read_bytes(), np.uint8)
        network = cv2.dnn.readNetFromONNX(np.frombuffer(emotion.read_bytes(), np.uint8))
        self.detector = cv2.FaceDetectorYN.create('onnx', model, np.empty(0, np.uint8), (320, 320), 0.85)
        self.network = network

    @staticmethod
    def align(frame, face):
        source = face[4:14].reshape(5, 2).astype(np.float64)
        target = np.array([[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]])
        matrix = np.zeros((10,4))
        matrix[0::2,:2] = source
        matrix[1::2,0] = source[:,1]
        matrix[1::2,1] = -source[:,0]
        matrix[0::2,2] = 1
        matrix[1::2,3] = 1
        a,b,tx,ty = np.linalg.lstsq(matrix, target.reshape(-1), rcond=None)[0]
        return cv2.warpAffine(frame, np.array([[a,b,tx],[-b,a,ty]]), (112,112))

    @staticmethod
    def softmax(logits):
        logits = np.asarray(logits, dtype=np.float64).reshape(-1)
        scores = np.exp(logits - logits.max())
        return scores / scores.sum()

    def predict_scores(self, aligned):
        # Both views keep the official RGB normalization and label order.
        # Average probabilities rather than promoting specific expressions.
        predictions = []
        for view in (aligned, cv2.flip(aligned, 1)):
            rgb = cv2.cvtColor(view, cv2.COLOR_BGR2RGB).astype(np.float32)
            self.network.setInput(cv2.dnn.blobFromImage((rgb / 255.0 - 0.5) / 0.5), 'data')
            predictions.append(self.softmax(self.network.forward('label')))
        return np.mean(predictions, axis=0)

    @staticmethod
    def quality_hint(frame, face):
        x, y, width, height = (int(v) for v in face[:4])
        crop = frame[max(y, 0):min(y + height, frame.shape[0]),
                     max(x, 0):min(x + width, frame.shape[1])]
        if not crop.size or min(width, height) < 90:
            return 'Acércate un poco: necesitamos ver mejor las cejas y la boca.'
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        brightness = float(gray.mean())
        if brightness < 55:
            return 'Tu rostro está oscuro. Busca una luz suave frente a ti.'
        if brightness > 215:
            return 'Hay demasiada luz sobre tu rostro. Evita la luz directa.'
        normalized = cv2.resize(gray, (112, 112), interpolation=cv2.INTER_AREA)
        if cv2.Laplacian(normalized, cv2.CV_64F).var() < 30:
            return 'La imagen está borrosa. Limpia la cámara y mantente quieto un momento.'
        if x < 0 or y < 0 or x + width > frame.shape[1] or y + height > frame.shape[0]:
            return 'Centra el rostro para que aparezca completo.'
        return ''

    def analyze(self, frame):
        with self.lock:
            self.load()
            self.detector.setInputSize((frame.shape[1],frame.shape[0]))
            _, faces = self.detector.detect(frame)
            results = []
            for face in ([] if faces is None else faces):
                scores = self.predict_scores(self.align(frame,face))
                index = int(scores.argmax())
                results.append({'box':[int(v) for v in face[:4]], 'emotion':LABELS[index],
                    'confidence':round(float(scores[index])*100,1),
                    'quality_hint':self.quality_hint(frame,face),
                    'scores':{label:round(float(score)*100,1) for label,score in zip(LABELS,scores)}})
            return results

emotion_service = EmotionService()
