# Postman Test Guide

## 1) Import collection
- Import file: `postman/NNPTUD-C2.postman_collection.json`

## 2) Run nhanh theo thứ tự
1. `1. Seed Data`
2. `2. Seed Info`
3. `3. Login Customer` (copy token trả về vào biến `token`)
4. `5. Get Cart`
5. `6. Reserve A Cart`
6. `7. Get All Reservations` (copy `_id` reservation vào biến `reservationId`)
7. `9. Get One Reservation`
8. `10. Cancel Reservation`

## 3) Test reserveItems
- Từ response `2. Seed Info`, lấy `products[0]._id` gán vào biến `productId`
- Run request `8. Reserve Items`

## Notes
- API seed: `POST /api/v1/testing/seed`
- API lấy thông tin seed: `GET /api/v1/testing/seed-info`
- Tài khoản seed:
  - admin / Admin@123
  - moderator / Moderator@123
  - customer / Customer@123
