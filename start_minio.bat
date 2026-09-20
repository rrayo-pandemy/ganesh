@echo off
REM Start MinIO (Windows) using Docker
docker run -p 9000:9000 -p 9001:9001 --name tienda_minio \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  -v %CD%\minio\data:/data \
  minio/minio server /data --console-address ":9001"
