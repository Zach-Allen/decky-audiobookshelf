FROM ghcr.io/steamdeckhomebrew/holo-base:latest

COPY smoke_test_mpv.py /usr/local/bin/smoke_test_mpv.py

RUN pacman -Sy --noconfirm --needed \
      autoconf automake base-devel git meson nasm ninja pkgconf \
      python python-jinja yasm alsa-lib libpulse openssl \
      fontconfig freetype2 fribidi harfbuzz \
    && yes | pacman -Scc

ENTRYPOINT ["/backend/entrypoint.sh"]
