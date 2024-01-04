import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    vus: 10000,       // Number of virtual users
    duration: '10s', // Test duration
};

export default function () {
    // Wait for all VUs to be ready
    sleep(Math.random() * 10);

    let response = http.get('http://localhost:3000/test'); // Replace with your URL

    check(response, {
        'is status 200': (r) => r.status === 200,
        'response body is not empty': (r) => r.body.length > 0,
    });

    // Keep the VUs running till the end of the test
    sleep(10 - __VU * 0.2);
}
