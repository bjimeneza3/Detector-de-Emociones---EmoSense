import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Student",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32, unique=True)),
                ("full_name", models.CharField(max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["full_name", "code"]},
        ),
        migrations.CreateModel(
            name="Attendance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("attended_on", models.DateField(default=django.utils.timezone.localdate)),
                ("recorded_at", models.DateTimeField(auto_now_add=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendance_records",
                        to="attendance.student",
                    ),
                ),
            ],
            options={"ordering": ["-recorded_at"]},
        ),
        migrations.AddConstraint(
            model_name="attendance",
            constraint=models.UniqueConstraint(
                fields=("student", "attended_on"),
                name="one_attendance_per_student_per_day",
            ),
        ),
    ]
