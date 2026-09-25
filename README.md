# UNVELOUR · Catálogo Motorsport

Sitio estático listo para GitHub Pages. Incluye los 5.493 productos de 47 colecciones del catálogo, con buscador, filtros, fichas ampliadas y animaciones suaves.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube todo el contenido de esta carpeta a la raíz del repositorio.
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama **main**, carpeta **/(root)** y pulsa **Save**.

GitHub mostrará la dirección pública cuando termine la publicación.

## Archivos principales

- `index.html`: estructura del catálogo.
- `styles.css`: diseño adaptable a celular y computadora, con entradas escalonadas, portada animada y estados hover.
- `app.js`: búsqueda, filtros y fichas de producto.
- `catalog-data.js`: datos de las 5.493 referencias.
- `assets/featured/`: imágenes destacadas de portada.

Las fotografías de producto se cargan desde el catálogo original y aparecen de forma progresiva para que el repositorio sea liviano.

El sitio no necesita servidor, base de datos ni instalación de dependencias.
