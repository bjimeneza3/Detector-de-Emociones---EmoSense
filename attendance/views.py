import logging
import cv2
import numpy as np
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST
from .services import emotion_service

@require_GET
def home(request):
    return render(request, 'attendance/home.html')

@require_GET
def detector(request):
    return render(request, 'attendance/detector.html')

@require_GET
def challenge(request):
    return render(request, 'attendance/challenge.html')

@require_POST
def analyze_emotions(request):
    image = request.FILES.get('image')
    if image is None or image.size == 0:
        return JsonResponse({'error':'Selecciona una imagen o inicia la cámara.'}, status=400)
    if image.size > 2 * 1024 * 1024:
        return JsonResponse({'error':'La imagen supera el límite de 2 MB.'}, status=400)
    try:
        frame = cv2.imdecode(np.frombuffer(image.read(),np.uint8),cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError('La imagen no es válida o no se pudo leer.')
        height,width = frame.shape[:2]
        if min(height,width) < 48:
            raise ValueError('La imagen debe medir al menos 48 × 48 píxeles.')
        if max(height,width) > 960:
            scale = 960 / max(height,width)
            frame = cv2.resize(frame,(round(width*scale),round(height*scale)))
        faces = emotion_service.analyze(frame)
    except ValueError as exc:
        return JsonResponse({'error':str(exc)},status=400)
    except RuntimeError as exc:
        return JsonResponse({'error':str(exc)},status=503)
    except cv2.error:
        logging.getLogger(__name__).exception('Error de inferencia')
        return JsonResponse({'error':'No se pudo procesar la imagen. Revisa los modelos de OpenCV.'},status=503)
    return JsonResponse({'faces':faces,'width':frame.shape[1],'height':frame.shape[0]})

