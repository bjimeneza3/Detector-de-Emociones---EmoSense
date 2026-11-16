"""Download official OpenCV Zoo models and verify their LFS SHA-256."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
ROOT = Path(__file__).resolve().parent.parent / 'data' / 'models'
MODELS = {
 'face_detection_yunet_2023mar.onnx':'face_detection_yunet',
 'facial_expression_recognition_mobilefacenet_2022july.onnx':'facial_expression_recognition',
}

def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    for filename,folder in MODELS.items():
        base = f'https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/{folder}'
        with urlopen(f'{base}/{filename}',timeout=60) as response:
            pointer = response.read().decode()
        digest = next(line.split('sha256:')[1] for line in pointer.splitlines() if line.startswith('oid '))
        target = ROOT / filename
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            url = f'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/{folder}/{filename}'
            with urlopen(url,timeout=120) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != digest:
                raise RuntimeError(f'Falló la verificación SHA-256: {filename}')
            target.write_bytes(data)
        license_url = f'{base}/LICENSE' if folder == 'face_detection_yunet' else 'https://www.apache.org/licenses/LICENSE-2.0.txt'
        license_file = ROOT / f'{folder}_LICENSE'
        if not license_file.exists():
            with urlopen(license_url,timeout=60) as response:
                license_file.write_bytes(response.read())
        print(f'OK: {filename}')

if __name__ == '__main__':
    main()
