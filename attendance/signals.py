import shutil

from django.conf import settings
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Student


@receiver(post_delete, sender=Student)
def remove_student_face_samples(sender, instance, **kwargs):
    sample_dir = (settings.FACE_SAMPLES_DIR / str(instance.pk)).resolve()
    sample_root = settings.FACE_SAMPLES_DIR.resolve()
    if sample_dir.parent != sample_root:
        raise RuntimeError("Refusing to remove face samples outside the configured data directory.")
    if sample_dir.exists():
        shutil.rmtree(sample_dir)
