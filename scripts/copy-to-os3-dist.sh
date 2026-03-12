#!/bin/bash

set -e

ARCHIVE="/ramdisk/wow3.tar.bz2"
DEST_DIR="/home/fabio/dev/web/os3-website-cf/tools/wow3"

pnpm build && cd dist
tar cfj $ARCHIVE *

cd "$DEST_DIR" || { echo "Failed to change directory to $DEST_DIR"; exit 1; }

rm -Rf *
tar xfj $ARCHIVE

echo "File copied"
