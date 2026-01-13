# Interactive 3D Model Gallery

This is an interactive 3D gallery built with Three.js that displays 3D models along a curved path. Users can scroll to move the camera along the path and view the models from different angles.

## Features

- Loads all GLB models from the `assets/model_original` folder
- Places models along a Catmull-Rom spline path on both sides
- Models face the camera for optimal viewing
- Smooth camera movement along the path using mouse wheel
- Dynamic fog to hide distant models and improve performance
- Responsive design that adapts to window size

## Requirements

- Node.js installed on your system
- A modern web browser that supports WebGL

## Setup Instructions

1. Make sure you have Node.js installed on your machine
2. Place your GLB model files in the `assets/model_original` folder
3. Open a terminal/command prompt in this directory
4. Run the local server:
   ```
   node server.js
   ```
5. Open your browser and navigate to `http://localhost:8080`

## Usage

- Scroll with your mouse wheel to move the camera along the path
- Watch as the models are positioned along the curved path
- The counter at the top shows how many models have been loaded

## Files Structure

- `index.html`: Main HTML page
- `main.js`: Three.js scene implementation
- `server.js`: Simple HTTP server to serve the application
- `assets/model_original/`: Folder containing the 3D models

## Performance Notes

- Models are loaded asynchronously to improve startup time
- Fog is used to hide distant models and improve rendering performance
- Models rotate slowly for better visualization of their 3D form