# Three.js 

This is a project to explore various computer graphics concepts using Three.js. The user can choose between several smaller apps and control their various app properties using the side bar on the right.

## Build

To build the project locally install npm and node and run the commands:
```
npm run build
npm run start
```

## Groovy Texture

This app shows off a vibrant texture of a goovy star on the screen. It's inspired by 1970's designs and color pallets. It uses a signed distance function in a fragment shader program to calculate the colors bands moving inwards. The user can change the 5 colors used to make the design.

## Mandlebrot Texture

This app shows the famous Mandlebrot set. It calculates whether the points are in the Mandlebrot set by iteravely calculating the funtion $Z_{n+1}=Z_n^2+C$ where $Z$ is the point on the screen and $C$ is an offset value. The app counts the number of iterations it takes for the function to converge or diverge and uses that number to calculate the color of the pixel on the screen. The user can zoom in using the mouse wheel and move around by clicking and dragging. A true Mandlebrot set has infinitely definition but because floating point values can only be so percise the image will start to look pixelated if you zoom in too far.

## Terrain Generation

This app generates random terrain on a spherical planet. It uses perlin noise to generate a height map. The vertex shader moves the vertices of the sphere along the normal direction. Positive values become land and negative values become water. The fragment shader colors them green and blue accordingly.