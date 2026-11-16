from django.db import models
from django.utils import timezone


class Student(models.Model):
    code = models.CharField(max_length=32, unique=True)
    full_name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name", "code"]

    def __str__(self):
        return f"{self.code} - {self.full_name}"


class Attendance(models.Model):
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    attended_on = models.DateField(default=timezone.localdate)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "attended_on"],
                name="one_attendance_per_student_per_day",
            )
        ]

    def __str__(self):
        return f"{self.student} - {self.attended_on}"
