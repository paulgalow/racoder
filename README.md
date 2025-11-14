# 📻 racoder

[![Docker Image](https://github.com/paulgalow/racoder/actions/workflows/docker-image.yml/badge.svg)](https://github.com/paulgalow/racoder/actions/workflows/docker-image.yml)
[![GitHub release (with filter)](https://img.shields.io/github/v/release/paulgalow/racoder)](https://hub.docker.com/r/paulgalow/racoder/tags)
[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/paulgalow/racoder/latest)](https://hub.docker.com/r/paulgalow/racoder/tags)
[![GitHub](https://img.shields.io/github/license/paulgalow/racoder)](https://github.com/paulgalow/racoder/blob/main/LICENSE)

Racoder is a lightweight Node.js web server that leverages [FFmpeg](https://ffmpeg.org/) to transcode Internet radio and video streams into HTTP MP3 streams. It supports a variety of input stream formats, including HLS, MPEG-DASH, and RTMP – essentially, anything that FFmpeg can handle.

## Use cases

- Stream Internet radio streams using different audio codecs (like AAC) to devices that only support MP3 playback
- Play HLS and MPEG-DASH streams on devices that don't support those protocols
- Transcode live video streams into audio only versions

## Design goals and trade-offs

- Minimize server requirements
  - Racoder runs inside a container with 256 MB of RAM and consumes very little CPU
- Minimize traffic volume
  - Racoder will only pull from an upstream source during the time a stream is requested
- Aimed at small (private) deployments
  - Each request spawns a separate instance of FFmpeg which consumes additional memory (approx. 20 MB of RAM per active stream) and network bandwidth

## Configuration options

Racoder supports two configuration modes (since v2):

1. **Single-stream mode**: Configure one stream using environment variables
2. **Multi-stream mode**: Configure multiple streams using a streams JSON file

### Single-stream mode

Configuration options are set using environment variables.

| Name         | Description                               | Default value | Example                                                                             |
| ------------ | ----------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| INPUT_STREAM | **Required**. URL for incoming stream     | N/A           | `https://artesimulcast.akamaized.net/hls/live/2030993/artelive_de/master_v180.m3u8` |
| BITRATE      | Transcoding bitrate for output MP3 stream | `128k`        | `320k`                                                                              |
| LOG_LEVEL    | Level of detail for log output            | `INFO`        | `DEBUG`                                                                             |
| OUTPUT_PATH  | URL path for output MP3 stream            | `/`           | `/my-station`                                                                       |
| TZ           | Timezone for log timestamps               | `UTC`         | `Europe/Berlin`                                                                     |

### Multi-stream mode

To configure multiple streams, create a streams JSON file and specify its path using the `STREAMS_FILE` environment variable. When `STREAMS_FILE` is set, single-stream environment variables (`INPUT_STREAM`, `OUTPUT_PATH`, `BITRATE`) are ignored.

Multi-stream mode requires Racoder v2.0 or later

#### Streams file structure

```json
{
  "defaults": {
    "bitrate": "128k"
  },
  "streams": [
    {
      "input": "https://example.com/stream1.m3u8",
      "output": "/stream1"
    },
    {
      "input": "https://example.com/stream2.m3u8",
      "output": "/stream2",
      "bitrate": "192k"
    }
  ]
}
```

**Streams file options:**

- `defaults` (optional): Default values applied to all streams
  - `bitrate`: Default bitrate for streams that don't specify one
- `streams` (required): Array of stream configurations
  - `input` (required): URL for the incoming stream
  - `output` (required): URL path for the output MP3 stream (must start with `/`)
  - `bitrate` (optional): Transcoding bitrate for this specific stream (overrides default)

**Environment variables for multi-stream mode:**

| Name         | Description                             | Default value | Example                |
| ------------ | --------------------------------------- | ------------- | ---------------------- |
| STREAMS_FILE | **Required**. Path to streams JSON file | N/A           | `/config/streams.json` |
| LOG_LEVEL    | Level of detail for log output          | `INFO`        | `DEBUG`                |
| TZ           | Timezone for log timestamps             | `UTC`         | `Europe/Berlin`        |

**Examples:**

- [Simple multi-stream config](https://github.com/paulgalow/racoder/blob/main/examples/config.simple.json)
- [Extended multi-stream config with defaults](https://github.com/paulgalow/racoder/blob/main/examples/config.extended.json)

## How to deploy

Pre-built Docker images for different architectures are available on [Docker Hub](https://hub.docker.com/r/paulgalow/racoder/) and the [GitHub Container Registry](https://github.com/paulgalow/racoder/pkgs/container/racoder/versions?filters%5Bversion_type%5D=tagged). Deploy using Docker Compose on a small home server like a Raspberry Pi or host it (for free) on fly.io.

**Security Note**: Examples use `--read-only` and `--cap-drop ALL` to run the container with minimal privileges. These are recommended for production deployments.

### Using Docker Run

#### Single-stream mode

Let's use a simple example and deploy an instance on our local client machine:

```sh
docker run \
  --rm \
  --read-only \
  --cap-drop ALL \
  --name racoder \
  --publish 3000:3000/tcp \
  --env INPUT_STREAM="https://as-hls-ww-live.akamaized.net/pool_26173715/live/ww/bbc_radio_four_extra/bbc_radio_four_extra.isml/bbc_radio_four_extra-audio%3d96000.norewind.m3u8" \
  paulgalow/racoder:latest
```

Racoder will serve its output stream at `http://<hostname>:3000/`. So for this example open `http://localhost:3000/` in your browser or media player of choice (like VLC, QuickTime, …) to listen to the output stream.

Here we are using the [BBC Radio 4 Extra HLS AAC stream](https://gist.github.com/bpsib/67089b959e4fa898af69fea59ad74bc3) as input, but it does not have to be an audio HLS stream. Streams using MPEG-DASH are supported as well, as are video HLS/MPEG-DASH streams.

#### Multi-stream mode

To run multiple streams, create a streams file (e.g., `streams.json`) and mount it into the container:

```sh
docker run \
  --rm \
  --read-only \
  --cap-drop ALL \
  --name racoder \
  --publish 3000:3000/tcp \
  --env STREAMS_FILE="/config/streams.json" \
  --volume "$(pwd)/streams.json:/config/streams.json:ro" \
  paulgalow/racoder:latest
```

With a streams file like this:

```json
{
  "streams": [
    {
      "input": "https://as-hls-ww-live.akamaized.net/pool_26173715/live/ww/bbc_radio_four_extra/bbc_radio_four_extra.isml/bbc_radio_four_extra-audio%3d96000.norewind.m3u8",
      "output": "/bbc-radio-4-extra",
      "bitrate": "128k"
    },
    {
      "input": "https://artesimulcast.akamaized.net/hls/live/2030993/artelive_de/master_v180.m3u8",
      "output": "/arte-de",
      "bitrate": "192k"
    }
  ]
}
```

Streams will be available at:

- `http://localhost:3000/bbc-radio-4-extra`
- `http://localhost:3000/arte-de`

### Using Docker Compose

- [Single-stream file example](https://github.com/paulgalow/racoder/blob/main/examples/docker-compose.single-stream.yml)
- [Multi-stream file example](https://github.com/paulgalow/racoder/blob/main/examples/docker-compose.multi-stream.yml)

### Using fly.io

- [Single-stream simple TOML example](https://github.com/paulgalow/racoder/blob/main/examples/fly.single-stream.simple.toml)
- [Single-stream extended TOML example](https://github.com/paulgalow/racoder/blob/main/examples/fly.single-stream.extended.toml)

## Monitoring

Racoder provides a `/healthcheck` endpoint that returns HTTP 200 when the server is running. This can be used for container health checks and load balancer configuration.

## Troubleshooting

### Debugging

Set `LOG_LEVEL=DEBUG` to see detailed FFmpeg output and stream processing information.

### Common issues

- **Stream not starting**: Verify the INPUT_STREAM URL is accessible from the container
- **High memory usage**: Each active client spawns a separate FFmpeg process (~20MB per stream)
- **Connection errors**: Ensure port 3000 is accessible and not blocked by firewalls
