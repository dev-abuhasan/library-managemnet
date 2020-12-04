const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');


//mongo DB info
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ubnkj.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(fileUpload());
app.use(express.static('./Public/UploadImg'));

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: "Library API",
      version: '1.0.0',
    },
  },
  apis: ["app.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

client.connect(err => {
  //librarian email collection
  const librarian = client.db(`${process.env.DB_NAME}`).collection(`${process.env.DB_LIBRARIAN}`);
  //Book collection
  const Book = client.db(`${process.env.DB_NAME}`).collection(`${process.env.DB_BOOK}`);

  //post check admin or not
  app.post('/check-admin', (req, res) => {
    const email = req.body.email;
    librarian.find({ email: email })
      .toArray((err, doc) => {
        if (doc.length === 0) {
          res.send({ admin: false });
        } else {
          res.send({ admin: true });
        }
      })
  });

  //Swagger Get 
  /**
     * @swagger
     * /get-all-books:
     *   get:
     *     description: Get all books
     *     responses:
     *       200:
     *         description: Success
     * 
     */
  app.get("/get-all-books", async (req, res) => {
    Book.find({})
      .toArray((err, docs) => {
        res.send(docs)
      })
  });

  //Swagger Post
  /**
    * @swagger
    * /add-books:
    *   post:
    *     description: Add books
    *     parameters:
    *      - name: bookName
    *        description: bookName
    *        in: formData
    *        required: true
    *        type: string
    *      - name: author
    *        description: author
    *        in: formData
    *        required: true
    *        type: string
    *      - name: genre
    *        description: genre
    *        in: formData
    *        required: true
    *        type: string
    *      - name: releaseDate
    *        description: releaseDate
    *        in: formData
    *        required: true
    *        type: string
    *      - name: bookImage
    *        description: bookImage
    *        in: formData
    *        required: true
    *        type: file
    *     responses:
    *       201:
    *         description: Your Post Success
    */
  app.post("/add-books", async (req, res) => {
    const bookName = req.body.bookName;
    const author = req.body.author;
    const genre = req.body.genre;
    const releaseDate = req.body.releaseDate;
    const statusOption = req.body.statusOption;
    const image = req.files.bookImage;
    const ImgPath = `${__dirname}/Public/UploadImg/${image.name}`;
    image.mv(ImgPath, err => {
      if (err) {
        res.status(500).send({
          success: false,
          msg: 'Failed to upload image'
        });
      }
      const newImg = fs.readFileSync(ImgPath);
      const enCoImg = newImg.toString('base64');
      const createImg = {
        contentType: image.mimetype,
        size: image.size,
        img: Buffer.from(enCoImg, 'base64')
      };
      Book.insertOne({ bookName, author, genre, releaseDate, statusOption, createImg })
        .then(result => {
          fs.remove(ImgPath, errors => {
            if (errors) {
              res.status(500).send({
                success: false,
                msg: 'Failed to remove image',
                msg2: 'Failed to upload Data'
              });
            }
            res.status(200).send({
              success: result.insertedCount > 0,
              name: `${image.name}`,
              msg: 'Image upload successful',
              msg2: 'Success to upload Data'
            });
          })
        })
    })
  });

  //delete swagger
  /**
   * @swagger
   * /delete-book/{id}:
   *  delete:
   *   summary: delete book
   *   description: delete book
   *   parameters:
   *    - in: path
   *      name: id
   *      schema:
   *       type: string
   *      required: true
   *      description: id of the delete book
   *   responses:
   *    200:
   *     description: success
   */
  app.delete('/delete-book/:id', (req, res) => {
    Book.deleteOne({ _id: ObjectId(req.params.id) })
      .then(result => {
        res.status(200).send({
          success: true,
          msg: 'Status update successful'
        });
      })
  })

  //Swagger update
  /**
   * @swagger
   * /update-single-book/{id}:
   *  patch:
   *   summary: update book
   *   description: update book
   *   parameters:
   *    - in: path
   *      name: id
   *      schema:
   *       type: string
   *      required: true
   *      description: id of the update book
   *    - name: bookName
   *      description: bookName
   *      in: formData
   *      required: true
   *      type: string
   *    - name: author
   *      description: author
   *      in: formData
   *      required: true
   *      type: string
   *    - name: genre
   *      description: genre
   *      in: formData
   *      required: true
   *      type: string
   *    - name: releaseDate
   *      description: releaseDate
   *      in: formData
   *      required: true
   *      type: string
   *   responses:
   *    200:
   *     description: success
   */
  app.patch("/update-single-book/:id", async (req, res) => {
    Book.updateOne({ _id: ObjectId(req.params.id) },
      {
        $set: {
          bookName: req.body.bookName,
          author: req.body.author,
          genre: req.body.genre,
          releaseDate: req.body.releaseDate,
        }
      })
      .then(result => {
        res.status(200).send({
          success: true,
          msg: 'Status update successful'
        });
      })
  });

  //update status
  app.patch('/update-statue/:id', (req, res) => {
    Book.updateOne({ _id: ObjectId(req.params.id) },
      {
        $set: {
          statusOption: req.body.statusOption
        }
      })
      .then(result => {
        res.status(200).send({
          success: result.insertedCount > 0,
          msg: 'Status update successful'
        });
      })
  });
  //delete
  app.delete('/delete-order/:id', (req, res) => {
    Book.deleteOne({ _id: ObjectId(req.params.id) })
      .then(result => {
        res.status(200).send({
          success: result.insertedCount > 0,
          msg: 'Status update successful'
        });
      })
  })


  //get all order data to admin
  app.get('/all-order-data/admin', (req, res) => {
    const email = req.query.email;
    librarian.find({ email: email })
      .toArray((err, doc) => {
        if (doc.length === 0) {
          res.status(500).send({
            success: false,
            msg: 'Please Login in as a Admin'
          });
        } else {
          Book.find({})
            .toArray((err, docs) => {
              res.send(docs);
            })
        }
      })
  });
  app.get("/get-active-book", (req, res) => {
    const filterObject = {};
    req.query.statusOption && (filterObject.statusOption = req.query.statusOption);
    Book.find(filterObject).toArray((err, docs) => {
      if (docs.length) {
        res.status(200).send(docs);
      } else {
        res.sendStatus(404);
      }
    });
  });
});

//default dir & client
app.get('/', (req, res) => {
  res.send('Abu Hasan');
})
app.listen(process.env.PORT || 5000);