from django.urls import path
from . import views
urlpatterns = [
    path('', views.home, name='home'),
    path('detector/', views.detector, name='detector'),
    path('reto/', views.challenge, name='challenge'),
    path('api/emotions/', views.analyze_emotions, name='analyze_emotions'),
]

