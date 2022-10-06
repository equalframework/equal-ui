#!/bin/bash
DEST=$(npm root -g)
if [ -d "$DEST/sb-shared-lib" ] 
then
    cp equal.bundle.js $DEST/sb-shared-lib/
else
    echo "Error: Directory $DEST/sb-shared-lib does not exists."
fi
