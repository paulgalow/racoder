# 📻 racoder

[![Docker Image](https://github.com/paulgalow/racoder/actions/workflows/docker-image.yml/badge.svg)](https://github.com/paulgalow/racoder/actions/workflows/docker-image.yml)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/paulgalow/racoder)](https://hub.docker.com/r/paulgalow/racoder/tags)
[![Docker Image Size with architecture (latest by date/latest semver)](https://img.shields.io/docker/image-size/paulgalow/racoder)](https://hub.docker.com/r/paulgalow/racoder/tags)
[![GitHub](https://img.shields.io/github/license/paulgalow/racoder)](https://github.com/paulgalow/racoder/blob/main/LICENSE)

Racoder is a simple Node.js web server using [FFmpeg](https://ffmpeg.org/) to transcode internet radio/video streams to MP3 streams. Supported input stream formats are HLS, MPEG-DASH, RTMP, basically anything FFmpeg can handle.

## Use cases

- Stream Internet radio streams using different audio codecs (like AAC) to devices that only support MP3 playback
- Play HLS and MPEG-DASH streams on devices that don't support those protocols
- Transcode live video streams into audio only versions

## Design goals and trade-offs

- Minimize server requirements
  - Racoder runs on 256 MB of RAM and consumes very little CPU
- Minimize traffic volume
  - Racoder will only pull from an upstream source during the time a stream is requested
- Aimed at small (private) deployments
  - Each request spawns a separate instance of FFmpeg which consumes additional memory (approx. 17-20 MB of RAM per active stream) and network bandwidth

## How to deploy

### Using Docker Run

Let's use a simple example and deploy an instance of racoder on our local client machine:

```sh
docker run \
  --rm \
  --name racoder \
  -e INPUT_STREAM="https://a.files.bbci.co.uk/media/live/manifesto/audio/simulcast/hls/nonuk/sbr_low/ak/bbc_radio_four_extra.m3u8" \
  -p 3000:3000/tcp \
  paulgalow/racoder:latest
```

Racoder will serve its output stream at `http://<hostname>:3000/`. So for this example open `http://localhost:3000/` in your browser or media player of choice (like VLC, QuickTime, …) to listen to the output stream.

Here we are using the [BBC Radio 4 Extra HLS AAC stream](https://en.everybodywiki.com/List_of_BBC_radio_stream_URLs#Digital-only_stations) as input, but it does not have to be an audio HLS stream. Streams using MPEG-DASH are supported as well, as are video HLS/MPEG-DASH streams.

### Using Docker Compose

- [Simple Compose file example](https://github.com/paulgalow/racoder/blob/main/examples/docker-compose.simple.yml)
- [Extended Compose file example](https://github.com/paulgalow/racoder/blob/main/examples/docker-compose.extended.yml)

### Using fly.io

- [Simple Fly.io TOML example](https://github.com/paulgalow/racoder/blob/main/examples/fly.simple.toml)
- [Extended Fly.io TOML example](https://github.com/paulgalow/racoder/blob/main/examples/fly.extended.toml)
