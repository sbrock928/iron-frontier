import Phaser from 'phaser'

/** Upper bound on retained instances per texture before overflow is destroyed. */
const MAX_RETAINED_PER_TEXTURE = 96

/**
 * Recycles short-lived visual-effect images.
 *
 * Every shot fired used to allocate and destroy three `GameObjects.Image`
 * instances (muzzle flash, projectile, impact). With a few dozen units trading
 * fire that is hundreds of object creations per second, all of which the
 * garbage collector eventually has to reclaim, producing periodic frame-time
 * spikes. Leasing from a pool keeps the working set constant.
 *
 * Leased images are fully reset on acquisition, so callers never inherit tint,
 * alpha, scale or blend state from a previous user.
 */
export class FxPool {
  private readonly free = new Map<string, Phaser.GameObjects.Image[]>()

  constructor(private readonly scene: Phaser.Scene) {
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
  }

  /** Takes an image from the pool, creating one only if none are available. */
  lease(texture: string, x: number, y: number): Phaser.GameObjects.Image {
    const bucket = this.free.get(texture)
    const recycled = bucket?.pop()

    if (recycled) {
      recycled.setPosition(x, y)
      recycled.setActive(true).setVisible(true)
      recycled.setAlpha(1).setScale(1).setRotation(0)
      recycled.clearTint()
      recycled.setBlendMode(Phaser.BlendModes.NORMAL)
      return recycled
    }

    return this.scene.add.image(x, y, texture)
  }

  /** Returns an image to the pool, or destroys it if the pool is already full. */
  release(image: Phaser.GameObjects.Image): void {
    if (!image.scene) return
    this.scene.tweens.killTweensOf(image)

    const texture = image.texture.key
    let bucket = this.free.get(texture)
    if (!bucket) {
      bucket = []
      this.free.set(texture, bucket)
    }

    if (bucket.length >= MAX_RETAINED_PER_TEXTURE) {
      image.destroy()
      return
    }

    image.setActive(false).setVisible(false)
    bucket.push(image)
  }

  /**
   * Leases an image, tweens it, and returns it to the pool automatically once
   * the tween finishes. Covers the common fire-and-forget effect case.
   */
  flash(
    texture: string,
    x: number,
    y: number,
    setup: (image: Phaser.GameObjects.Image) => void,
    tween: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>,
  ): Phaser.GameObjects.Image {
    const image = this.lease(texture, x, y)
    setup(image)
    const onComplete = tween.onComplete
    this.scene.tweens.add({
      ...tween,
      targets: image,
      onComplete: (...args: Parameters<Phaser.Types.Tweens.TweenOnCompleteCallback>) => {
        if (typeof onComplete === 'function') onComplete(...args)
        this.release(image)
      },
    })
    return image
  }

  destroy(): void {
    for (const bucket of this.free.values()) {
      for (const image of bucket) image.destroy()
      bucket.length = 0
    }
    this.free.clear()
  }
}
