from flask import session, redirect
def login_required(roles=None):
    def decorator(func):
        def wrapper(*args, **kwargs):
            if "user" not in session:
                return redirect("/login")

            if roles:
                if isinstance(roles, list):
                    if session.get("role") not in roles:
                        return "Forbidden", 403
                else:
                    if session.get("role") != roles:
                        return "Forbidden", 403

            return func(*args, **kwargs)
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator