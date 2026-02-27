#!/bin/bash

set -e

ARCHIVE="/ramdisk/wow3.tar.bz2"
DEST_DIR="/home/fabio/dev/web/os3-website-cf/tools/wow3"

tar cfj $ARCHIVE css js icons mobile index.html manifest.json sw.js

cd $DEST_DIR

if [ $? -ne 0 ]; then
    echo "Failed to change directory to $DEST_DIR"
    exit 1
fi

rm -Rf *
tar xfj $ARCHIVE

echo "File copied"
