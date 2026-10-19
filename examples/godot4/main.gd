extends Node2D

## Ensures the imported SpriteFrames clip plays on ready.
func _ready() -> void:
	var sprite := $AnimatedSprite2D as AnimatedSprite2D
	if sprite and sprite.sprite_frames:
		sprite.play("default")
