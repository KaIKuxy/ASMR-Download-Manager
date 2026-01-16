# ASMR Download Manager Extension

A Chrome Extension designed to enhance the experience on ASMR.one by providing integrated download management capabilities. Built with **React** and **Vite** for a modern, performant user experience.

## 🚀 Features

-   **Seamless Integration**: Automatically injects download buttons into ASMR.one work cards.
-   **Smart Queue**: Manage your downloads efficiently through a dedicated popup interface.
-   **Visual Feedback**: Real-time status updates (Downloading, Completed, Error) directly on the UI.
-   **Modern Tech Stack**: extensive use of React 19 and Vite for fast builds and hot reloading during development.

## 🛠️ Installation (Developer Mode)

1.  **Clone the repository**
    ```bash
    git clone https://github.com/KaIKuxy/ASMR-Download-Manager.git
    cd ASMR-Download-Manager
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Build the Extension**
    ```bash
    npm run build
    ```

4.  **Load into Chrome**
    -   Open Chrome and navigate to `chrome://extensions/`
    -   Enable **Developer mode** (toggle in the top right corner).
    -   Click **Load unpacked**.
    -   Select the `dist` directory created by the build command.

## 💻 Development

To start the development server with hot module replacement (HMR):

```bash
npm run dev
```

The extension will rebuild automatically as you make changes. Note that for content scripts, you may need to reload the extension or the web page to see changes.

## 🏗️ Project Structure

-   `src/content/`: Scripts injected into the webpage (DOM manipulation, button injection).
-   `src/background/`: Service workers for handling long-running background tasks.
-   `src/components/`: React components for the Popup and injected UI.
-   `manifest.json`: Chrome Extension manifest configuration.
-   `vite.config.js`: Vite configuration for bundling the extension.

## 📄 License

ISC
