---
title: "JavaScript Fundamentals"
author: "Frontend Team"
category: "Programming"
tags: ["javascript", "frontend", "programming", "web development"]
difficulty: "beginner"
last_updated: "2024-01-10"
---

# JavaScript Fundamentals

JavaScript adalah bahasa pemrograman yang powerful dan flexible, primarily digunakan untuk web development. Bahasa ini essential untuk frontend development dan juga populer untuk backend development dengan Node.js.

## Sejarah JavaScript

JavaScript dibuat oleh Brendan Eich di Netscape pada tahun 1995. Meskipun namanya mirip dengan Java, kedua bahasa ini completely different. JavaScript awalnya dibuat untuk menambah interactivity pada web pages.

## Variables dan Data Types

### Variable Declaration
```javascript
// ES6+ style (recommended)
let name = "John";
const age = 25;

// Old style (avoid)
var city = "Jakarta";

// Dynamic typing
let value = 42;        // Number
value = "Hello";       // Now it's String
value = true;          // Now it's Boolean
```

### Data Types
JavaScript memiliki beberapa primitive data types:

1. **String**: Text data
   ```javascript
   let message = "Hello World";
   let template = `Welcome ${name}!`;  // Template literal
   ```

2. **Number**: Integer dan floating point
   ```javascript
   let count = 42;
   let price = 99.99;
   let infinity = Infinity;
   let notNumber = NaN;
   ```

3. **Boolean**: true atau false
   ```javascript
   let isActive = true;
   let isComplete = false;
   ```

4. **Undefined**: Variable yang declared tapi belum assigned
   ```javascript
   let undefinedVar;
   console.log(undefinedVar); // undefined
   ```

5. **Null**: Intentionally empty value
   ```javascript
   let emptyValue = null;
   ```

6. **Symbol**: Unique identifier (ES6+)
   ```javascript
   let sym = Symbol('id');
   ```

7. **BigInt**: Large integers (ES2020)
   ```javascript
   let bigNumber = 1234567890123456789012345678901234567890n;
   ```

## Functions

### Function Declaration
```javascript
function greet(name) {
    return `Hello, ${name}!`;
}

// Function Expression
const greet2 = function(name) {
    return `Hello, ${name}!`;
};

// Arrow Function (ES6+)
const greet3 = (name) => `Hello, ${name}!`;
const greet4 = name => `Hello, ${name}!`;  // Single parameter
```

### Function Features
```javascript
// Default Parameters
function createUser(name, role = "user") {
    return { name, role };
}

// Rest Parameters
function sum(...numbers) {
    return numbers.reduce((total, num) => total + num, 0);
}

// Destructuring Parameters
function displayUser({name, email, age = 0}) {
    console.log(`${name} (${age}): ${email}`);
}
```

## Objects dan Arrays

### Objects
```javascript
// Object Literal
const user = {
    name: "Alice",
    age: 30,
    email: "alice@example.com",
    greet() {
        return `Hi, I'm ${this.name}`;
    }
};

// Accessing properties
console.log(user.name);        // Dot notation
console.log(user['email']);    // Bracket notation

// Adding properties
user.city = "Jakarta";
user['country'] = "Indonesia";

// Object destructuring
const {name, email} = user;
```

### Arrays
```javascript
// Array creation
const fruits = ["apple", "banana", "orange"];
const numbers = new Array(1, 2, 3, 4, 5);

// Array methods
fruits.push("grape");           // Add to end
fruits.unshift("mango");       // Add to beginning
fruits.pop();                  // Remove from end
fruits.shift();                // Remove from beginning

// Array iteration
fruits.forEach(fruit => console.log(fruit));
const uppercaseFruits = fruits.map(fruit => fruit.toUpperCase());
const longFruits = fruits.filter(fruit => fruit.length > 5);

// Array destructuring
const [first, second, ...rest] = fruits;
```

## Control Flow

### Conditional Statements
```javascript
// If statement
if (age >= 18) {
    console.log("Adult");
} else if (age >= 13) {
    console.log("Teenager");
} else {
    console.log("Child");
}

// Ternary operator
const status = age >= 18 ? "adult" : "minor";

// Switch statement
switch (day) {
    case "monday":
        console.log("Start of work week");
        break;
    case "friday":
        console.log("TGIF!");
        break;
    default:
        console.log("Regular day");
}
```

### Loops
```javascript
// For loop
for (let i = 0; i < 5; i++) {
    console.log(i);
}

// For...of loop (for arrays)
for (const fruit of fruits) {
    console.log(fruit);
}

// For...in loop (for objects)
for (const key in user) {
    console.log(`${key}: ${user[key]}`);
}

// While loop
let count = 0;
while (count < 5) {
    console.log(count);
    count++;
}
```

## Modern JavaScript (ES6+)

### Template Literals
```javascript
const name = "World";
const greeting = `Hello, ${name}!`;
const multiline = `
    This is a
    multiline string
`;
```

### Destructuring
```javascript
// Array destructuring
const [a, b, c] = [1, 2, 3];

// Object destructuring
const {name, email} = user;
const {name: userName, email: userEmail} = user;  // Rename
```

### Spread Operator
```javascript
// Array spread
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5];  // [1, 2, 3, 4, 5]

// Object spread
const newUser = {...user, age: 31, city: "Bandung"};
```

### Modules (ES6)
```javascript
// export (math.js)
export const PI = 3.14159;
export function add(a, b) {
    return a + b;
}
export default function multiply(a, b) {
    return a * b;
}

// import (main.js)
import multiply, {PI, add} from './math.js';
import * as math from './math.js';
```

## Asynchronous JavaScript

### Promises
```javascript
// Creating Promise
const fetchData = () => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const success = true;
            if (success) {
                resolve("Data fetched successfully");
            } else {
                reject("Failed to fetch data");
            }
        }, 1000);
    });
};

// Using Promise
fetchData()
    .then(data => console.log(data))
    .catch(error => console.error(error));
```

### Async/Await
```javascript
// Async function
async function getData() {
    try {
        const data = await fetchData();
        console.log(data);
        return data;
    } catch (error) {
        console.error("Error:", error);
    }
}

// Using async/await
getData();
```

## DOM Manipulation

```javascript
// Selecting elements
const element = document.getElementById('myId');
const elements = document.querySelectorAll('.myClass');

// Creating elements
const newDiv = document.createElement('div');
newDiv.textContent = 'Hello World';
newDiv.classList.add('highlight');

// Adding to DOM
document.body.appendChild(newDiv);

// Event handling
element.addEventListener('click', function(event) {
    console.log('Element clicked!');
    event.preventDefault();
});
```

## Error Handling

```javascript
try {
    // Code that might throw error
    const result = riskyOperation();
    console.log(result);
} catch (error) {
    console.error('An error occurred:', error.message);
} finally {
    console.log('This always runs');
}

// Custom errors
class CustomError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CustomError';
    }
}
```

## Best Practices

### 1. Use const dan let instead of var
```javascript
// Good
const PI = 3.14159;
let counter = 0;

// Avoid
var oldStyle = "avoid this";
```

### 2. Use meaningful variable names
```javascript
// Good
const userAge = 25;
const isUserActive = true;

// Bad
const a = 25;
const flag = true;
```

### 3. Use strict mode
```javascript
'use strict';
// Your code here
```

### 4. Handle errors properly
```javascript
async function fetchUserData(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        throw error;
    }
}
```

## Common Patterns

### Module Pattern
```javascript
const MyModule = (function() {
    let privateVar = 0;
    
    function privateFunction() {
        console.log('This is private');
    }
    
    return {
        publicMethod() {
            privateVar++;
            return privateVar;
        },
        
        getValue() {
            return privateVar;
        }
    };
})();
```

### Constructor Pattern
```javascript
function User(name, email) {
    this.name = name;
    this.email = email;
}

User.prototype.greet = function() {
    return `Hello, I'm ${this.name}`;
};

// ES6 Class syntax
class User {
    constructor(name, email) {
        this.name = name;
        this.email = email;
    }
    
    greet() {
        return `Hello, I'm ${this.name}`;
    }
}
```

JavaScript adalah bahasa yang constantly evolving dengan new features ditambahkan regularly. Menguasai fundamentals ini akan memberikan foundation yang solid untuk advanced JavaScript concepts dan frameworks seperti React, Vue, atau Node.js.