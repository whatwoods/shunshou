#!/bin/sh
# 把一个目录里的帧拼成一张小样：sh promo/scripts/sheet.sh <目录> <输出.png> [列数] [每格宽]
dir=$1; out=$2; cols=${3:-2}; w=${4:-720}
n=$(ls "$dir"/t*.png | wc -l | tr -d ' ')
rows=$(( (n + cols - 1) / cols ))
ffmpeg -loglevel error -y -reinit_filter 0 -pattern_type glob -i "$dir/t*.png" -vf "format=rgb24,scale=$w:-1,drawbox=x=0:y=0:w=iw:h=ih:color=gray@0.6:t=1,tile=${cols}x${rows}" -frames:v 1 "$out"
