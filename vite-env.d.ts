/// <reference types="vite/client" />

// Allow importing images as URLs
declare module '*.png?url' {
    const src: string;
    export default src;
}

declare module '*.png' {
    const src: string;
    export default src;
}

declare module '*.jpg?url' {
    const src: string;
    export default src;
}

declare module '*.webp?url' {
    const src: string;
    export default src;
}
