import bpy
import json
import math
import os

from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


scene = bpy.context.scene
camera = bpy.data.objects["CAMERA_REFERENCE_PIANGO"]
root = bpy.data.objects["CORONEL_SCHOOLHOUSE_3x3"]
target = Vector((0.0, 0.0, 1.5))
distance = 20.0
output_dir = os.path.join(os.getcwd(), "tmp", "blender", "schoolhouse-canonical-azimuths")
os.makedirs(output_dir, exist_ok=True)

# Values measured by the earlier calibration against roof/wall = 1.479.
views = (
    ("direita", 0.0, 56.7754),
    ("frontal", 10.0, 59.5051),
    ("esquerda", 20.0, 63.2080),
)


def set_camera(azimuth_degrees, elevation_degrees):
    azimuth = math.radians(azimuth_degrees)
    elevation = math.radians(elevation_degrees)
    view_direction = Vector((
        math.sin(azimuth) * math.cos(elevation),
        math.cos(azimuth) * math.cos(elevation),
        -math.sin(elevation),
    ))
    camera.location = target - view_direction * distance
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()


def schoolhouse_roof_wall_ratio():
    # Same architectural cut in every view: central ridge -> front eave, then
    # front eave -> ground. Points are local to the rotated/scaled house root.
    ridge = root.matrix_world @ Vector((0.0, 0.0, 4.05))
    eave = root.matrix_world @ Vector((0.0, -1.25, 3.72))
    ground = root.matrix_world @ Vector((0.0, -1.25, 0.0))
    ridge_y = world_to_camera_view(scene, camera, ridge).y
    eave_y = world_to_camera_view(scene, camera, eave).y
    ground_y = world_to_camera_view(scene, camera, ground).y
    roof_height = abs(ridge_y - eave_y)
    wall_height = abs(eave_y - ground_y)
    return roof_height / wall_height


original_location = camera.location.copy()
original_rotation = camera.rotation_euler.copy()
original_path = scene.render.filepath
original_x = scene.render.resolution_x
original_y = scene.render.resolution_y
results = []

try:
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    for name, azimuth, elevation in views:
        set_camera(azimuth, elevation)
        path = os.path.join(output_dir, f"schoolhouse_{name}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        results.append({
            "nome": name,
            "azimute": azimuth,
            "elevacao": elevation,
            "roof_wall_reference_ratio": 1.479,
            "schoolhouse_roof_wall_ratio": round(schoolhouse_roof_wall_ratio(), 4),
            "render": path,
        })
finally:
    camera.location = original_location
    camera.rotation_euler = original_rotation
    scene.render.filepath = original_path
    scene.render.resolution_x = original_x
    scene.render.resolution_y = original_y
    bpy.context.view_layer.update()

metrics_path = os.path.join(output_dir, "canonical_views.json")
with open(metrics_path, "w", encoding="utf-8") as handle:
    json.dump(results, handle, ensure_ascii=False, indent=2)

print(json.dumps({"metrics": metrics_path, "views": results}, ensure_ascii=True))
