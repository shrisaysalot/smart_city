import os, sys, django
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
os.environ['USE_SQLITE'] = 'True'
django.setup()

from django.contrib.auth.models import User
from app.models import UserProfile

users = [
    {'username': 'admin', 'password': 'admin123', 'name': 'Admin User', 'role': 'admin', 'wards': []},
    {'username': 'planner', 'password': 'planner123', 'name': 'City Planner', 'role': 'planner', 'wards': []},
    {'username': 'engineer', 'password': 'engineer123', 'name': 'Ward Engineer', 'role': 'engineer', 'wards': ['44', '32', '23', '7', '15']},
]

for u in users:
    if not User.objects.filter(username=u['username']).exists():
        user = User.objects.create_user(u['username'], password=u['password'])
        name_parts = u['name'].split()
        user.first_name = name_parts[0]
        user.last_name = name_parts[-1] if len(name_parts) > 1 else ''
        user.save()
        UserProfile.objects.create(user=user, role=u['role'], assigned_wards=u['wards'])
        print(f"Created: {u['username']} ({u['role']})")
    else:
        print(f"Already exists: {u['username']}")
