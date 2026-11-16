from unittest.mock import patch, Mock
import cv2
import numpy as np
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, Client
from django.urls import reverse
from .services import EmotionService

class EmotionFlowTests(TestCase):
    def image(self, width=640, height=480):
        _, encoded = cv2.imencode('.jpg', np.zeros((height,width,3),np.uint8))
        return SimpleUploadedFile('image.jpg',encoded.tobytes(),content_type='image/jpeg')

    def test_home_and_new_workflow(self):
        response = self.client.get(reverse('home'))
        self.assertContains(response,'Detección de emociones')
        self.assertContains(response,'Cómo funciona')
        self.assertContains(response, 'href="' + reverse('detector') + '"')
        self.assertNotContains(response, 'id="camera-toggle"')
        self.assertNotContains(response, 'attendance/app.js')
        self.assertNotContains(response,'Registrar estudiante')

    def test_detector_is_separate_and_has_navigation(self):
        response = self.client.get(reverse('detector'))
        self.assertContains(response,'Analizar fotografía')
        self.assertContains(response,'id="camera-toggle"')
        self.assertContains(response,'id="emotion-emoji"')
        self.assertContains(response,'Volver al inicio')
        self.assertContains(response, reverse('home') + '#como-funciona')
        self.assertNotContains(response, 'id="start-experience"')

    def test_challenge_is_separate_from_detector(self):
        response = self.client.get(reverse('challenge'))
        self.assertContains(response, 'id="challenge-video"')
        self.assertContains(response, 'id="curiosity"')
        self.assertContains(response, 'id="challenge-confetti"')
        self.assertNotContains(response, 'attendance/app.js')
        detector = self.client.get(reverse('detector'))
        self.assertNotContains(detector, 'attendance/challenge.js')
        self.assertContains(self.client.get(reverse('home')), 'href="' + reverse('challenge') + '"')

    def test_analysis_returns_predictions(self):
        faces = [{'box':[10,10,100,100],'emotion':'Alegría','confidence':89.5,'scores':{'Alegría':89.5}}]
        with patch('attendance.views.emotion_service.analyze',return_value=faces):
            response = self.client.post(reverse('analyze_emotions'),{'image':self.image()})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['faces'],faces)

    def test_no_faces_is_success(self):
        with patch('attendance.views.emotion_service.analyze',return_value=[]):
            response = self.client.post(reverse('analyze_emotions'),{'image':self.image()})
        self.assertEqual(response.json()['faces'],[])

    def test_bad_input(self):
        for payload in ({},{'image':SimpleUploadedFile('bad.jpg',b'bad')},{'image':self.image(20,20)}):
            self.assertEqual(self.client.post(reverse('analyze_emotions'),payload).status_code,400)

    def test_large_upload(self):
        response = self.client.post(reverse('analyze_emotions'),{'image':SimpleUploadedFile('large.jpg',b'x'*(2*1024*1024+1))})
        self.assertEqual(response.status_code,400)

    def test_resize_keeps_aspect_ratio(self):
        with patch('attendance.views.emotion_service.analyze',return_value=[]) as analyze:
            response = self.client.post(reverse('analyze_emotions'),{'image':self.image(1600,800)})
        self.assertEqual(analyze.call_args.args[0].shape,(480,960,3))
        self.assertEqual(response.json()['width'],960)

    def test_missing_models_is_actionable(self):
        with patch('attendance.views.emotion_service.analyze',side_effect=RuntimeError('Faltan los modelos.')):
            response = self.client.post(reverse('analyze_emotions'),{'image':self.image()})
        self.assertEqual(response.status_code,503)

    def test_method_and_csrf(self):
        self.assertEqual(self.client.get(reverse('analyze_emotions')).status_code,405)
        self.assertEqual(Client(enforce_csrf_checks=True).post(reverse('analyze_emotions')).status_code,403)

    def test_alignment_preserves_canonical_face(self):
        frame = np.random.default_rng(42).integers(0,256,(112,112,3),dtype=np.uint8)
        landmarks = [38.2946,51.6963,73.5318,51.5014,56.0252,71.7366,41.5493,92.3655,70.7299,92.2041]
        aligned = EmotionService.align(frame,np.array([0,0,112,112]+landmarks+[1]))
        np.testing.assert_array_equal(aligned,frame)



class PredictionQualityTests(TestCase):
    def test_softmax_is_stable_for_large_logits(self):
        scores = EmotionService.softmax([10000, 9999, 9998, 9997, 9996, 9995, 9994])
        self.assertTrue(np.isfinite(scores).all())
        self.assertAlmostEqual(float(scores.sum()), 1.0)
        self.assertEqual(int(scores.argmax()), 0)

    def test_two_views_average_without_class_bias(self):
        service = EmotionService()
        service.network = Mock()
        # Enojo in one view, Tristeza in the other: no forced preference.
        service.network.forward.side_effect = [
            np.array([[4, 0, 0, 0, 0, 1, 0]], np.float32),
            np.array([[1, 0, 0, 0, 0, 4, 0]], np.float32),
        ]
        aligned = np.zeros((112, 112, 3), np.uint8)
        aligned[:, :56, 2] = 255
        scores = service.predict_scores(aligned)
        self.assertAlmostEqual(float(scores[0]), float(scores[5]))
        self.assertAlmostEqual(float(scores.sum()), 1.0)
        blobs = [call.args[0] for call in service.network.setInput.call_args_list]
        np.testing.assert_array_equal(blobs[1], blobs[0][:, :, :, ::-1])
        self.assertEqual(blobs[0].shape, (1, 3, 112, 112))
        self.assertEqual(blobs[0].dtype, np.float32)
        self.assertEqual(float(blobs[0].min()), -1.0)
        self.assertEqual(float(blobs[0].max()), 1.0)

    def test_quality_detects_small_dark_and_blurry_faces(self):
        face = np.array([10, 10, 110, 110])
        small = np.array([10, 10, 60, 60])
        frame = np.full((160, 160, 3), 120, np.uint8)
        self.assertIn('cejas', EmotionService.quality_hint(frame, small))
        self.assertIn('oscuro', EmotionService.quality_hint(np.zeros_like(frame), face))
        self.assertIn('borrosa', EmotionService.quality_hint(frame, face))
        texture = np.random.default_rng(4).integers(70, 190, frame.shape, dtype=np.uint8)
        self.assertEqual(EmotionService.quality_hint(texture, face), '')

