/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { EyedropperIcon, PlusIcon } from '@phosphor-icons/react'
import { RgbaColorPicker } from 'react-colorful'
import { Button } from './button'
import { Input } from './input'

const DEFAULT_CHILDREN = (
  <div className="flex aspect-square h-fit w-fit items-center justify-center rounded-full bg-gradient-to-br from-pink-300/20 via-violet-300/20 to-indigo-300/20 p-[0.2rem] md:p-[0.2vw]">
    <div className="flex aspect-square h-[2rem] items-center justify-center rounded-full bg-gradient-to-br from-pink-300 via-violet-300 to-indigo-300 md:h-[2vw]">
      <EyedropperIcon className="aspect-square w-[1rem] text-white md:w-[1vw]" />
    </div>
  </div>
)

type TColorPicker = {
  value: string
  onChange: (value: string) => void
  handleAdd?: (value: string) => void
  children?: React.ReactNode
}

function rgbaToHex(r: number, g: number, b: number, a: number = 1) {
  const toHex = (n: number) => {
    let hex = n.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  const alpha = isNaN(a) ? 255 : Math.round(a * 255)

  return `#${toHex(r)}${toHex(g)}${toHex(b)}${
    alpha === 255 ? '' : toHex(alpha)
  }`
}

function hexToRgba(hex: string) {
  if (!hex) return null
  hex = hex.replace(/^#/, '')

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('')
  }

  if (hex.length !== 6 && hex.length !== 8) return null

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1

  return { r, g, b, a }
}

const ColorPicker: React.FC<TColorPicker> = ({
  value,
  onChange,
  handleAdd,
  children = DEFAULT_CHILDREN,
}) => {
  // Local state for the color picker to make the drag buttery-smooth
  const [localColor, setLocalColor] = useState(
    () => hexToRgba(value) || { r: 0, g: 0, b: 0, a: 1 },
  )

  // Synchronize local color state with `value` prop if changed from outside
  useEffect(() => {
    const rgba = hexToRgba(value)
    if (rgba) {
      const currentLocalHex = rgbaToHex(
        localColor.r,
        localColor.g,
        localColor.b,
        localColor.a,
      )
      if (currentLocalHex.toLowerCase() !== value.toLowerCase()) {
        setLocalColor(rgba)
      }
    }
  }, [value])

  const color = useMemo(() => {
    const rgba = hexToRgba(value)
    return { hex: value, alpha: rgba ? rgba.a : 1 }
  }, [value])

  const handleChangeAlpha = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAlpha = parseFloat(e.target.value)
    const rgba = hexToRgba(color.hex)
    if (rgba) {
      const newHex = rgbaToHex(rgba.r, rgba.g, rgba.b, newAlpha)
      setLocalColor({ ...rgba, a: newAlpha })
      onChange(newHex)
    }
  }

  const handleChangeColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor: any = e.target.value
    const rgba = hexToRgba(newColor)
    if (rgba) {
      setLocalColor(rgba)
    }
    onChange(newColor)
  }

  const handleColorChange = useCallback(
    (newColor: { r: number; g: number; b: number; a: number }) => {
      setLocalColor(newColor)
      const { r, g, b, a } = newColor
      const newHex = rgbaToHex(r, g, b, a)
      onChange(newHex)
    },
    [onChange],
  )

  return (
    <Popover>
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className="bg-popover text-popover-foreground border-border w-[18rem] rounded-none p-4 shadow-md"
      >
        <div className="flex flex-col gap-3">
          <h3 className="text-muted-foreground w-full text-left text-xs font-semibold tracking-wider uppercase">
            Color Picker
          </h3>
          <RgbaColorPicker
            color={localColor}
            onChange={handleColorChange}
            className="border-border aspect-square !w-full overflow-hidden rounded-none border"
          />
          <div className="flex flex-col gap-3">
            <div className="flex h-8 w-full items-center justify-center">
              <label className="text-muted-foreground mr-2 shrink-0 text-[10px] font-semibold uppercase">
                HEX
              </label>
              <Input
                className="bg-background border-input h-8 w-full !rounded-r-none border-r-0 font-mono text-[10px] !tracking-widest"
                value={color.hex}
                onChange={handleChangeColor}
              />
              <Input
                type="text"
                min="0"
                max="1"
                step="0.01"
                value={color.alpha.toFixed(2)}
                onChange={handleChangeAlpha}
                className="bg-background border-input h-8 w-[3.5rem] !rounded-l-none !pr-0 text-center font-mono text-[10px] tracking-widest"
              />
            </div>
            {handleAdd && (
              <Button
                size="sm"
                className="w-full gap-1 text-[10px]"
                onClick={() => handleAdd(value)}
              >
                <PlusIcon className="size-3" />
                Add Color
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ColorPicker
