from PIL import Image
import os

def remove_white_bg(input_path, output_path, tolerance=240):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # If pixel is close to white, make it transparent
        if item[0] >= tolerance and item[1] >= tolerance and item[2] >= tolerance:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(output_path, "PNG")

files = ['bird_flying.png', 'bird_waving.png']
base_dir = r"apps\landing\public\stickers"

for file in files:
    in_path = os.path.join(base_dir, file)
    out_path = os.path.join(base_dir, file.replace('.png', '_transparent.png'))
    if os.path.exists(in_path):
        remove_white_bg(in_path, out_path)
        print(f"Created {out_path}")
    else:
        print(f"File not found: {in_path}")
