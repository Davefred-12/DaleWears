function initMap() {
    const location = { lat: 40.712776, lng: -74.005974 };
    //  Example coordinates for New York City

    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: location,
    });

    const marker = new google.maps.Marker({
        position: location,
        map: map,
        title: "DaleWears",
    });
}

function closeNotification() {
    document.getElementById("notification").style.display = "none";
}

document.getElementById("contactForm").addEventListener("submit", function(event) {
    event.preventDefault();

    // Simulate form submission
    setTimeout(() => {
        document.getElementById("notification").style.display = "block";
    }, 500);
});



