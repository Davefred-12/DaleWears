// Hamburger Menu Functionality
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});
document.querySelector('.hamburger').addEventListener('click', function() {
    document.querySelector('.nav-links').classList.toggle('show');
});


// Slider Functionality
const slider = document.querySelector('.slider');
const slides = document.querySelectorAll('.slide');
let slideIndex = 0;
let slideInterval;

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.style.opacity = i === index ? '1' : '0';
    });
}

function nextSlide() {
    slideIndex = (slideIndex + 1) % slides.length;
    showSlide(slideIndex);
}

slider.addEventListener('mouseover', () => {
    clearInterval(slideInterval);
    nextSlide();
});

slider.addEventListener('mouseleave', () => {
    slideInterval = setInterval(nextSlide, 2000); // Change slide every 2 seconds
});

// Initialize the first slide and start the interval
showSlide(slideIndex);
slideInterval = setInterval(nextSlide, 2000);
