#!/usr/bin/env python3
"""
Stratify AI — Unified System Orchestrator.
Launches and manages all distributed system processes with graceful signal handling:
1. FastAPI API Coordinator (Port 8000)
2. Transactional Outbox Relay Daemon
3. Independent Research Worker (worker-alpha)
4. Next.js Responsive Frontend (Port 3000)
"""

import os
import signal
import subprocess
import sys
import time

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
VENV_PYTHON = os.path.join(PROJECT_ROOT, ".venv", "bin", "python")
VENV_UVICORN = os.path.join(PROJECT_ROOT, ".venv", "bin", "uvicorn")

if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable
if not os.path.exists(VENV_UVICORN):
    VENV_UVICORN = "uvicorn"

PROCESSES: list[tuple[str, subprocess.Popen]] = []


def start_process(name: str, cmd: list[str], cwd: str = PROJECT_ROOT) -> subprocess.Popen:
    print(f"\033[1;36m[STARTING]\033[0m {name}: {' '.join(cmd)}")
    env = os.environ.copy()
    env["PYTHONPATH"] = PROJECT_ROOT
    proc = subprocess.Popen(cmd, cwd=cwd, env=env)
    PROCESSES.append((name, proc))
    return proc


def shutdown(signum=None, frame=None):
    print("\n\033[1;33m[SHUTDOWN]\033[0m Terminating Stratify AI cluster...")
    for name, proc in reversed(PROCESSES):
        if proc.poll() is None:
            print(f"  Stopping {name} (PID: {proc.pid})...")
            proc.terminate()

    # Allow 4 seconds for graceful worker drain
    time.sleep(2)

    for name, proc in PROCESSES:
        if proc.poll() is None:
            print(f"  Force-killing {name}...")
            proc.kill()

    print("\033[1;32m[SHUTDOWN COMPLETE]\033[0m All processes terminated cleanly.")
    sys.exit(0)


def check_prerequisites():
    print("\033[1;34m[SYSTEM CHECK]\033[0m Validating infrastructure prerequisites...")
    import socket

    # 1. Check PostgreSQL on 5434
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", 5434))
        s.close()
        print("  ✓ PostgreSQL active on 127.0.0.1:5434")
    except OSError:
        print("\033[1;31m[ERROR]\033[0m PostgreSQL is not reachable on 127.0.0.1:5434!")
        print("  Run: docker compose -f docker/docker-compose.yml up -d")
        sys.exit(1)

    # 2. Check RabbitMQ on 5672
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", 5672))
        s.close()
        print("  ✓ RabbitMQ active on 127.0.0.1:5672")
    except OSError:
        print("\033[1;31m[ERROR]\033[0m RabbitMQ is not reachable on 127.0.0.1:5672!")
        print("  Run: docker compose -f docker/docker-compose.yml up -d")
        sys.exit(1)


def apply_migrations():
    print("\033[1;34m[DATABASE]\033[0m Applying database schema migrations...")
    alembic_cmd = [VENV_PYTHON, "-m", "alembic", "upgrade", "head"]
    result = subprocess.run(alembic_cmd, check=False, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        print("\033[1;31m[ERROR]\033[0m Alembic migration failed.")
        sys.exit(1)
    print("  ✓ Database schema up to date.")


def main():
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    check_prerequisites()
    apply_migrations()

    print("\n\033[1;32m====================================================\033[0m")
    print("\033[1;32m   STRATIFY AI — MULTI-AGENT INTELLIGENCE PLATFORM  \033[0m")
    print("\033[1;32m====================================================\033[0m\n")

    # 1. API Coordinator
    start_process(
        name="FastAPI Coordinator",
        cmd=[VENV_PYTHON, "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    )

    # 2. Outbox Relay
    start_process(
        name="Outbox Relay Daemon",
        cmd=[VENV_PYTHON, "-m", "backend.app.broker.relay_worker"],
    )

    # 3. Independent Worker
    start_process(
        name="Python Worker (worker-alpha)",
        cmd=[VENV_PYTHON, "-m", "workers.main", "--worker-id", "worker-alpha", "--concurrency", "2"],
    )

    # 4. Next.js Frontend
    start_process(
        name="Next.js Frontend",
        cmd=["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
    )

    print("\n\033[1;32m✓ Stratify AI Platform Online!\033[0m")
    print("  • Frontend: [http://localhost:3000](http://localhost:3000)")
    print("  • FastAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)")
    print("  • RabbitMQ Admin: [http://localhost:15672](http://localhost:15672)")
    print("\nPress Ctrl+C to terminate all services gracefully.\n")

    try:
        while True:
            time.sleep(1)
            # Check if any child process died unexpectedly
            for name, proc in PROCESSES:
                code = proc.poll()
                if code is not None and code != 0:
                    print(f"\033[1;31m[CRASH]\033[0m {name} exited with code {code}!")
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
