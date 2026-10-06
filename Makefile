PORT ?= 8799
PY ?= .venv/bin/python

.PHONY: serve setup frames audio video check clean

serve:
	python3 -m http.server $(PORT) --bind 127.0.0.1 --directory web

setup:
	python3 -m venv .venv
	.venv/bin/pip install -r requirements.txt
	.venv/bin/playwright install chromium

frames:
	$(PY) tools/render.py build/frames 0 -1 30

audio:
	$(PY) tools/audio.py build/barrel.wav 19

video: frames audio
	sh tools/encode.sh build/frames build/barrel.wav build/barrel.mp4

check:
	$(PY) -m pyflakes tools

clean:
	rm -rf build
