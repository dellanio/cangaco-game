import bpy
import json
import math
import os

from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


scene = bpy.context.scene
camera = bpy.data.objects["CAMERA_REFERENCE_PIANGO"]
house = bpy.data.objects["REFERENCE_HOUSE_3x2"]
target = Vector((0.0, 0.0, 1.5))
distance = 20.0
target_ratio = 1.479
output_dir = os.path.join(os.getcwd(), "tmp", "blender", "azimuth-comparison")
os.makedirs(output_dir, exist_ok=True)


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


def screen_point(point):
    projected = world_to_camera_view(scene, camera, Vector(point))
    return Vector((projected.x * scene.render.resolution_x, projected.y * scene.render.resolution_y))


def projected_height(object_names):
    values = []
    for object_name in object_names:
        obj = bpy.data.objects[object_name]
        values.extend(screen_point(obj.matrix_world @ Vector(corner)).y for corner in obj.bound_box)
    return max(values) - min(values)


def roof_wall_ratio():
    roof_height = projected_height(("HOUSE_ROOF_FRONT", "HOUSE_ROOF_BACK"))
    facade_points = (
        (-1.36, -0.86, 0.0),
        (1.36, -0.86, 0.0),
        (-1.36, -0.86, 2.14),
        (1.36, -0.86, 2.14),
    )
    facade_rows = [screen_point(point).y for point in facade_points]
    wall_height = max(facade_rows) - min(facade_rows)
    return roof_height / wall_height, roof_height, wall_height


def calibrated_elevation(azimuth_degrees):
    low, high = 40.0, 70.0
    set_camera(azimuth_degrees, low)
    low_ratio, _, _ = roof_wall_ratio()
    set_camera(azimuth_degrees, high)
    high_ratio, _, _ = roof_wall_ratio()
    increasing = high_ratio > low_ratio
    for _ in range(45):
        middle = (low + high) / 2.0
        set_camera(azimuth_degrees, middle)
        ratio, _, _ = roof_wall_ratio()
        if (ratio < target_ratio) == increasing:
            low = middle
        else:
            high = middle
    return (low + high) / 2.0


def edge_metrics():
    front_left = screen_point((-1.5, -1.0, 0.0))
    front_right = screen_point((1.5, -1.0, 0.0))
    back_left = screen_point((-1.5, 1.0, 0.0))
    back_right = screen_point((1.5, 1.0, 0.0))
    width_vector = back_right - back_left
    depth_vector = back_left - front_left
    return {
        "width_px": width_vector.length,
        "depth_px": depth_vector.length,
        "depth_to_width": depth_vector.length / width_vector.length,
        "back_edge_angle_degrees": math.degrees(math.atan2(abs(width_vector.y), abs(width_vector.x))),
    }


original_location = camera.location.copy()
original_rotation = camera.rotation_euler.copy()
original_filepath = scene.render.filepath
original_visibility = {obj.name: obj.hide_render for obj in scene.objects}

for obj in scene.objects:
    if obj == house or obj.parent == house:
        obj.hide_render = False
    elif obj.type == "MESH":
        obj.hide_render = True

results = []
try:
    for azimuth in (0, 10, 20, 30):
        elevation = calibrated_elevation(azimuth)
        set_camera(azimuth, elevation)
        ratio, roof_px, wall_px = roof_wall_ratio()
        metrics = edge_metrics()
        output_path = os.path.join(output_dir, f"reference_house_azimuth_{azimuth:02d}.png")
        scene.render.filepath = output_path
        bpy.ops.render.render(write_still=True)
        results.append({
            "azimuth_degrees": azimuth,
            "elevation_degrees": round(elevation, 4),
            "roof_wall_ratio": round(ratio, 4),
            "roof_height_px_projected": round(roof_px, 2),
            "wall_height_px_projected": round(wall_px, 2),
            "width_px": round(metrics["width_px"], 2),
            "depth_px": round(metrics["depth_px"], 2),
            "depth_to_width": round(metrics["depth_to_width"], 4),
            "back_edge_angle_degrees": round(metrics["back_edge_angle_degrees"], 2),
            "render": output_path,
        })
finally:
    set_camera(0.0, 56.0)
    scene.render.filepath = original_filepath
    for name, hidden in original_visibility.items():
        if name in bpy.data.objects:
            bpy.data.objects[name].hide_render = hidden

metrics_path = os.path.join(output_dir, "azimuth_metrics.json")
with open(metrics_path, "w", encoding="utf-8") as handle:
    json.dump(results, handle, ensure_ascii=False, indent=2)

print(json.dumps({"metrics": metrics_path, "results": results}, ensure_ascii=True))
