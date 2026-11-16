from django.contrib import admin

from .models import Attendance, Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("code", "full_name", "created_at")
    search_fields = ("code", "full_name")


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("student", "attended_on", "recorded_at")
    list_filter = ("attended_on",)
    search_fields = ("student__code", "student__full_name")
