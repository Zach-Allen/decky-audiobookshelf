FROM ghcr.io/steamdeckhomebrew/holo-base:latest

RUN pacman -Sy --noconfirm --needed \
      autoconf automake base-devel git meson nasm ninja pkgconf \
      python python-jinja yasm alsa-lib libpulse openssl \
    && yes | pacman -Scc

ENTRYPOINT ["/backend/entrypoint.sh"]
