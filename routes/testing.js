var express = require('express');
var router = express.Router();

let roleModel = require('../schemas/roles');
let userModel = require('../schemas/users');
let cartModel = require('../schemas/cart');
let productModel = require('../schemas/products');
let inventoryModel = require('../schemas/inventories');
let reservationModel = require('../schemas/reservations');

router.post('/seed', async function (req, res, next) {
    try {
        await reservationModel.deleteMany({});
        await cartModel.deleteMany({});
        await inventoryModel.deleteMany({});
        await productModel.deleteMany({});
        await userModel.deleteMany({});
        await roleModel.deleteMany({});

        let adminRole = await roleModel.create({
            name: 'ADMIN',
            description: 'System administrator'
        });

        let moderatorRole = await roleModel.create({
            name: 'MODERATOR',
            description: 'Content moderator'
        });

        let customerRole = await roleModel.create({
            name: 'CUSTOMER',
            description: 'Customer account'
        });

        let adminUser = await userModel.create({
            username: 'admin',
            password: 'Admin@123',
            email: 'admin@test.com',
            role: adminRole._id,
            fullName: 'Admin User',
            status: true
        });

        let moderatorUser = await userModel.create({
            username: 'moderator',
            password: 'Moderator@123',
            email: 'moderator@test.com',
            role: moderatorRole._id,
            fullName: 'Moderator User',
            status: true
        });

        let customerUser = await userModel.create({
            username: 'customer',
            password: 'Customer@123',
            email: 'customer@test.com',
            role: customerRole._id,
            fullName: 'Customer User',
            status: true
        });

        let products = await productModel.insertMany([
            {
                title: 'IPhone 15 Pro Max',
                slug: 'iphone-15-pro-max',
                description: 'Apple flagship phone',
                price: 32000000,
                category: 'phone',
                images: ['https://example.com/iphone15.jpg']
            },
            {
                title: 'Samsung Galaxy S25',
                slug: 'samsung-galaxy-s25',
                description: 'Samsung flagship phone',
                price: 26000000,
                category: 'phone',
                images: ['https://example.com/s25.jpg']
            },
            {
                title: 'Macbook Air M4',
                slug: 'macbook-air-m4',
                description: 'Lightweight laptop',
                price: 34000000,
                category: 'laptop',
                images: ['https://example.com/macbookairm4.jpg']
            }
        ]);

        await inventoryModel.insertMany([
            {
                product: products[0]._id,
                stock: 50,
                reserved: 0,
                soldCount: 0
            },
            {
                product: products[1]._id,
                stock: 50,
                reserved: 0,
                soldCount: 0
            },
            {
                product: products[2]._id,
                stock: 30,
                reserved: 0,
                soldCount: 0
            }
        ]);

        let cart = await cartModel.create({
            user: customerUser._id,
            items: [
                {
                    product: products[0]._id,
                    quantity: 1
                },
                {
                    product: products[1]._id,
                    quantity: 2
                }
            ]
        });

        res.send({
            message: 'Seed data created successfully',
            credentials: {
                admin: { username: 'admin', password: 'Admin@123' },
                moderator: { username: 'moderator', password: 'Moderator@123' },
                customer: { username: 'customer', password: 'Customer@123' }
            },
            roleIds: {
                adminRoleId: adminRole._id,
                moderatorRoleId: moderatorRole._id,
                customerRoleId: customerRole._id
            },
            userIds: {
                adminUserId: adminUser._id,
                moderatorUserId: moderatorUser._id,
                customerUserId: customerUser._id
            },
            productIds: products.map(function (product) {
                return {
                    id: product._id,
                    title: product.title,
                    price: product.price
                };
            }),
            cartId: cart._id
        });
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

router.get('/seed-info', async function (req, res, next) {
    let customer = await userModel.findOne({ username: 'customer' }).select('_id username email');
    let products = await productModel.find({ isDeleted: false }).select('_id title price category').limit(20);
    let cart = null;

    if (customer) {
        cart = await cartModel.findOne({ user: customer._id }).populate({
            path: 'items.product',
            select: 'title price'
        });
    }

    res.send({
        credentials: {
            admin: { username: 'admin', password: 'Admin@123' },
            moderator: { username: 'moderator', password: 'Moderator@123' },
            customer: { username: 'customer', password: 'Customer@123' }
        },
        customer: customer,
        products: products,
        cart: cart
    });
});

module.exports = router;
