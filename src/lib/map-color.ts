/** Mapbox paint accepts sRGB, not the OKLCH values in semantic theme tokens. */
export function mapColor(value: string): string {
  const element = document.createElement("span");
  element.style.color = value.startsWith("--") ? `var(${value})` : value;
  document.body.appendChild(element);
  const color = getComputedStyle(element).color;
  const context = document.createElement("canvas").getContext("2d");
  element.remove();
  if (!context) return color;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
}