var express = require('express');
var router = express.Router();
let mongoose = require('mongoose');
let { checkLogin } = require('../utils/authHandler.js');
let reservationModel = require('../schemas/reservations');
let cartModel = require('../schemas/cart');
let inventoryModel = require('../schemas/inventories');
let productModel = require('../schemas/products');

async function reserveItemsForUser(userId, inputItems, session) {
    if (!Array.isArray(inputItems) || inputItems.length === 0) {
        throw new Error('Danh sach san pham khong hop le');
    }

    let mergedMap = new Map();
    for (const item of inputItems) {
        if (!item || !item.product) {
            throw new Error('Thieu product trong danh sach');
        }
        let quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error('Quantity phai la so nguyen duong');
        }
        let productId = item.product.toString();
        let oldQuantity = mergedMap.get(productId) || 0;
        mergedMap.set(productId, oldQuantity + quantity);
    }

    let normalizedItems = [];
    for (const [product, quantity] of mergedMap.entries()) {
        normalizedItems.push({ product: product, quantity: quantity });
    }

    let productIds = normalizedItems.map(function (e) {
        return e.product;
    });

    let inventories = await inventoryModel.find({
        product: { $in: productIds }
    }).session(session);

    if (inventories.length !== productIds.length) {
        throw new Error('Mot hoac nhieu san pham khong co trong kho');
    }

    let invMap = new Map();
    for (const inv of inventories) {
        invMap.set(inv.product.toString(), inv);
    }

    for (const item of normalizedItems) {
        let inv = invMap.get(item.product.toString());
        if (!inv || inv.stock < item.quantity) {
            throw new Error('San pham khong du so luong ton kho');
        }
    }

    let products = await productModel.find({
        _id: { $in: productIds },
        isDeleted: false
    }).session(session);

    if (products.length !== productIds.length) {
        throw new Error('Mot hoac nhieu san pham khong ton tai');
    }

    let productMap = new Map();
    for (const product of products) {
        productMap.set(product._id.toString(), product);
    }

    for (const item of normalizedItems) {
        let inv = invMap.get(item.product.toString());
        inv.stock -= item.quantity;
        inv.reserved += item.quantity;
        await inv.save({ session });
    }

    let reservationItems = normalizedItems.map(function (item) {
        let product = productMap.get(item.product.toString());
        let price = Number(product.price) || 0;
        return {
            product: product._id,
            quantity: item.quantity,
            price: price,
            subtotal: price * item.quantity
        };
    });

    let totalAmount = reservationItems.reduce(function (sum, item) {
        return sum + item.subtotal;
    }, 0);

    let currentReservation = await reservationModel.findOne({
        user: userId
    }).session(session);

    if (!currentReservation) {
        currentReservation = new reservationModel({
            user: userId
        });
    }

    currentReservation.items = reservationItems;
    currentReservation.totalAmount = totalAmount;
    currentReservation.status = 'actived';
    currentReservation.ExpiredAt = new Date(Date.now() + 15 * 60 * 1000);

    await currentReservation.save({ session });

    return currentReservation;
}

router.get('/', checkLogin, async function (req, res, next) {
    let userId = req.userId;
    let reservations = await reservationModel.find({
        user: userId
    }).populate({
        path: 'items.product',
        select: 'title price images'
    });
    res.send(reservations);
});

router.get('/:id', checkLogin, async function (req, res, next) {
    let userId = req.userId;
    let id = req.params.id;
    try {
        let reservation = await reservationModel.findOne({
            _id: id,
            user: userId
        }).populate({
            path: 'items.product',
            select: 'title price images'
        });

        if (!reservation) {
            res.status(404).send({ message: 'Reservation not found' });
            return;
        }

        res.send(reservation);
    } catch (error) {
        res.status(404).send({ message: 'Reservation not found' });
    }
});

router.post('/reserveACart', checkLogin, async function (req, res, next) {
    let userId = req.userId;
    let session = await mongoose.startSession();
    session.startTransaction();

    try {
        let currentCart = await cartModel.findOne({
            user: userId
        }).session(session);

        if (!currentCart || !currentCart.items || currentCart.items.length === 0) {
            throw new Error('Cart dang rong');
        }

        let reservation = await reserveItemsForUser(userId, currentCart.items, session);

        currentCart.items = [];
        await currentCart.save({ session });

        await session.commitTransaction();
        session.endSession();

        let result = await reservationModel.findById(reservation._id).populate({
            path: 'items.product',
            select: 'title price images'
        });

        res.send(result);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({ message: error.message });
    }
});

router.post('/reserveItems', checkLogin, async function (req, res, next) {
    let userId = req.userId;
    let items = req.body.items;

    let session = await mongoose.startSession();
    session.startTransaction();

    try {
        let reservation = await reserveItemsForUser(userId, items, session);

        await session.commitTransaction();
        session.endSession();

        let result = await reservationModel.findById(reservation._id).populate({
            path: 'items.product',
            select: 'title price images'
        });

        res.send(result);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({ message: error.message });
    }
});

router.post('/cancelReserve/:id', checkLogin, async function (req, res, next) {
    let userId = req.userId;
    let id = req.params.id;

    try {
        let reservation = await reservationModel.findOne({
            _id: id,
            user: userId
        });

        if (!reservation) {
            res.status(404).send({ message: 'Reservation not found' });
            return;
        }

        if (reservation.status === 'cancelled') {
            res.send(reservation);
            return;
        }

        for (const item of reservation.items) {
            let inventory = await inventoryModel.findOne({
                product: item.product
            });

            if (!inventory) {
                continue;
            }

            inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
            inventory.stock += item.quantity;
            await inventory.save();
        }

        reservation.status = 'cancelled';
        await reservation.save();

        res.send(reservation);
    } catch (error) {
        res.status(400).send({ message: error.message });
    }
});

module.exports = router;
