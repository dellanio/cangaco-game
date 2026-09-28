"""Create compact Schoolhouse candidates without scaling its two storeys.

Usage:
  blender -b --python tools/blender/rebuild-compressed-schoolhouse.py -- completo
  blender -b --python tools/blender/rebuild-compressed-schoolhouse.py -- madeira

Candidate renders and .blend files stay under tmp/blender until visually approved.
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector


PROJECT = os.environ.get("PIANCO_PROJECT_ROOT", os.getcwd())
SOURCE = os.path.join(PROJECT, "assets", "source", "blender", "buildings", "schoolhouse.blend")
STATE = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "completo"
OUT_DIR = os.path.join(PROJECT, "tmp", "blender", "schoolhouse-compressed")


def children_of(root):
    return [obj for obj in bpy.context.scene.objects if obj == root or obj.parent == root]


def compact_roof(prefix):
    roof = bpy.data.objects.get(prefix + "HIP_ROOF")
    ridge = bpy.data.objects.get(prefix + "RIDGE_CAP")
    if roof is not None:
        # Keep the eaves and footprint fixed; lower only the ridge vertices.
        world_eave = min(v.co.z for v in roof.data.vertices)
        old_peak = max(v.co.z for v in roof.data.vertices)
        factor = 0.50
        for vertex in roof.data.vertices:
            # RTS caricature: compress the roof plane towards the ridge. Width
            # remains generous, but depth no longer consumes an extra tile.
            vertex.co.y *= 0.90
            vertex.co.z = world_eave + (vertex.co.z - world_eave) * factor
        new_peak = world_eave + (old_peak - world_eave) * factor
        if ridge is not None:
            ridge.location.z -= old_peak - new_peak

    veranda = bpy.data.objects.get(prefix + "VERANDA_ROOF")
    if veranda is not None:
        # Reduce its vertical silhouette while preserving its shade and coverage.
        veranda.scale.y *= 0.72
        veranda.scale.z *= 0.62
        veranda.location.z -= 0.10


def compact_stairs(prefix):
    stairs = [bpy.data.objects.get(prefix + f"STAIR_{index}") for index in range(4)]
    stairs = [obj for obj in stairs if obj is not None]
    landing = bpy.data.objects.get(prefix + "STAIR_LANDING")
    # Four shallow caricature steps: enough to read as access, too short to claim a tile.
    for index, stair in enumerate(stairs):
        height = 0.042 * (index + 1)
        depth = 0.085 + index * 0.035
        stair.dimensions = (1.05, depth, height)
        stair.location = (0.0, -1.57 + index * 0.045, height / 2.0)
        bpy.context.view_layer.objects.active = stair
        stair.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        stair.select_set(False)
    if landing is not None:
        landing.dimensions = (1.05, 0.20, 0.19)
        landing.location = (0.0, -1.30, 0.095)
        bpy.context.view_layer.objects.active = landing
        landing.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        landing.select_set(False)


def set_camera():
    camera = bpy.data.objects["CAMERA_REFERENCE_PIANGO"]
    target = Vector((0.0, 0.0, 1.65))
    azimuth = math.radians(10.0)
    elevation = math.radians(59.5051)
    direction = Vector((
        math.sin(azimuth) * math.cos(elevation),
        math.cos(azimuth) * math.cos(elevation),
        -math.sin(elevation),
    ))
    camera.location = target - direction * 20.0
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 7.1
    bpy.context.scene.camera = camera


def main():
    if STATE not in {"completo", "madeira"}:
        raise ValueError("state must be completo or madeira")
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=SOURCE)
    finished = bpy.data.objects["CORONEL_SCHOOLHOUSE_3x3"]
    wood = bpy.data.objects.get("CORONEL_WOOD_STAGE_3x3")

    # Compress depth, not storey height. This keeps the two-storey silhouette
    # while reducing the vertical screen space caused by the high camera.
    # 0.556 * 0.90 (roof-local factor above) = 0.50: roof depth and
    # ridge height are reduced by the same amount, preserving its pitch.
    finished.scale.y *= 0.556
    if wood is not None:
        wood.scale.y *= 0.556

    compact_roof("CORONEL_")
    compact_stairs("CORONEL_")
    compact_roof("CORONEL_WOOD_")
    compact_stairs("CORONEL_WOOD_")

    for obj in children_of(finished):
        obj.hide_render = STATE != "completo"
    if wood is not None:
        for obj in children_of(wood):
            obj.hide_render = STATE != "madeira"

    set_camera()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    output = os.path.join(OUT_DIR, f"schoolhouse_{STATE}_render_1024.png")
    scene.render.filepath = output
    bpy.ops.render.render(write_still=True)
    blend = os.path.join(OUT_DIR, f"schoolhouse_{STATE}_candidate.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print(json.dumps({"state": STATE, "render": output, "blend": blend}))


main()
