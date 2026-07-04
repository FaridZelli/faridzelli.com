// ----------------------------------------
// https://github.com/FaridZelli
// ----------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------
  // External Links
  // ------------------------------

  const links = document.querySelectorAll('a[href]');
  links.forEach(link => {
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });

  // ------------------------------
  // Code Block Copy Button
  // ------------------------------

  document.querySelectorAll('.markdown-body pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.onclick = () => {
      navigator.clipboard.writeText(code.innerText);
      btn.textContent = 'Copied';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    };
    pre.appendChild(btn);
  });

  // ------------------------------
  // Floating Shapes
  // ------------------------------

  const shapeConfigs = {
    'svg-shapes-less': 25,
    'svg-shapes-more': 50
  };

  // Dynamically create selector string from config keys
  const selectorString = Object.keys(shapeConfigs).map(key => `.${key}`).join(', ');
  const containers = document.querySelectorAll(selectorString);

  const shapes = [{
    name: "triangle",
    svg: `<path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"></path>`
  },
  {
    name: "square",
    svg: `<path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"></path>`
  },
  {
    name: "diamond",
    svg: `<path d="M10.831 20.413l-5.375 -6.91c-.608 -.783 -.608 -2.223 0 -3l5.375 -6.911a1.457 1.457 0 0 1 2.338 0l5.375 6.91c.608 .783 .608 2.223 0 3l-5.375 6.911a1.457 1.457 0 0 1 -2.338 0z"></path>`
  },
  {
    name: "rectangle",
    svg: `<path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"></path>`
  },
  {
    name: "octagon",
    svg: `<path d="M12.802 2.165l5.575 2.389c.48 .206 .863 .589 1.07 1.07l2.388 5.574c.22 .512 .22 1.092 0 1.604l-2.389 5.575c-.206 .48 -.589 .863 -1.07 1.07l-5.574 2.388c-.512 .22 -1.092 .22 -1.604 0l-5.575 -2.389a2.036 2.036 0 0 1 -1.07 -1.07l-2.388 -5.574a2.036 2.036 0 0 1 0 -1.604l2.389 -5.575c.206 -.48 .589 -.863 1.07 -1.07l5.574 -2.388a2.036 2.036 0 0 1 1.604 0z"></path>`
  }
  ];

  containers.forEach(container => {
    // Determine count based on which config class matches the container
    let shapeCount = 0;
    for (const [className, count] of Object.entries(shapeConfigs)) {
      if (container.classList.contains(className)) {
        shapeCount = count;
        break;
      }
    }

    // Skip if no valid config class is found
    if (shapeCount === 0) return;

    for (let i = 0; i < shapeCount; i++) {
      const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
      const shapeElement = document.createElement("div");
      shapeElement.classList.add("shape", randomShape.name);
      shapeElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#7F4300" stroke="#FFA742" stroke-linecap="round" stroke-linejoin="round" width="24" height="24" stroke-width="2">${randomShape.svg}</svg>`;
      const randomX = Math.random() * 100;
      const randomY = Math.random() * 100;
      shapeElement.style.left = `${randomX}%`;
      shapeElement.style.top = `${randomY}%`;
      const animations = ["moveDiagonal", "moveUpDown", "moveSideways"];
      shapeElement.style.animation = `${animations[Math.floor(Math.random() * animations.length)]} ${Math.random() * 15 + 3}s infinite alternate`;

      container.appendChild(shapeElement);
    }
  });
});
