# Detección de emociones mediante expresiones faciales

Aplicación local con Django, Python y OpenCV. Analiza la cámara o una fotografía y clasifica siete expresiones: enojo, disgusto, miedo, alegría, neutral, tristeza y sorpresa. Muestra un recuadro por rostro y puntuaciones para el rostro de mayor tamaño.

## Instalación en Windows

Requiere Python 3.10 o superior. Desde PowerShell en esta carpeta:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python scripts/download_models.py
python manage.py migrate
python manage.py runserver
```

Abre http://127.0.0.1:8000/ e inicia la cámara o selecciona una fotografía de hasta 2 MB. La cámara requiere permiso del navegador y localhost o HTTPS. Detén la cámara con el mismo botón.

El script descarga los modelos oficiales de OpenCV Zoo y verifica los SHA-256 publicados en sus punteros Git LFS. Conserva los archivos de licencia en data/models. Solo la descarga inicial necesita Internet; el análisis funciona localmente.

## Modelo y resultados

Se usa YuNet para detectar rostros y cinco puntos faciales; MobileFaceNet / Progressive Teacher clasifica la expresión tras alinear el rostro y normalizar la imagen RGB a [-1,1]. Las puntuaciones se obtienen aplicando softmax a las salidas. Son puntuaciones relativas del modelo, no probabilidades calibradas ni una medición del estado emocional interno. La iluminación, la pose y las características de cada rostro afectan el resultado.

Fuentes oficiales:
- https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
- https://github.com/opencv/opencv_zoo/tree/main/models/facial_expression_recognition

## Datos

Las imágenes se procesan en memoria y no se guardan. No se crean registros de estudiantes ni asistencias. Los modelos y migraciones antiguos se conservan para no borrar la base de datos y muestras existentes; ya no forman parte del flujo principal. Los nombres internos attendance y attendance_project se mantienen por compatibilidad.

SQLite es la base predeterminada. PostgreSQL sigue disponible con DATABASE_ENGINE=postgresql y las variables POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST y POSTGRES_PORT. Las tablas administrativas requieren migrate.

## Verificación

```powershell
python manage.py check
python manage.py test
```

Las pruebas cubren la nueva página, predicciones, ausencia de rostros, entradas inválidas, tamaño de archivos, redimensionamiento, modelos ausentes, CSRF y alineación. La calidad real de clasificación debe evaluarse con imágenes representativas.

Para despliegue configura DJANGO_SECRET_KEY, DJANGO_DEBUG=False y DJANGO_ALLOWED_HOSTS; sirve el sitio con HTTPS.


## Captura y estabilidad

La cámara solicita hasta 1280 x 720 y envía JPEG de calidad 94%, con un máximo de 960 píxeles. Cada rostro se evalúa alineado y reflejado horizontalmente; se promedian las dos distribuciones softmax, sin favorecer ninguna clase. Las transiciones claras son inmediatas y las ambiguas requieren dos predicciones consecutivas. Se esperan 250 ms después de cada respuesta, sin solicitudes simultáneas. Se muestran avisos orientativos de luz, nitidez y distancia.

Estos cambios se verifican funcionalmente; no constituyen una mejora de exactitud medida en un conjunto etiquetado. El modelo puede seguir confundiendo tristeza, enojo y neutral en algunas personas.
