const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const {
    MongoClient,
    ServerApiVersion
} = require('mongodb');
const { emit } = require('nodemon');
const app = express();
const port = process.env.PORT || 5000;


//middleware
app.use(cors());
app.use(express.json());


// For database connection
// DB_USER=doctor_admn
// DB_PASSWORD=yP85fyvWTB0kgtie
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.qs7t4ng.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
});

function verifyJWT(req, res, next){
    const authheader = req.headers.authorization;
    if(!authheader){
        return res.status(401).send({message:'Unauthorized Access'});
    }
    const token = authheader.split(' ')[1];
    // console.log(token);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message:'Forbidden Access'});
        }
        req.decoded = decoded;
        // console.log(decoded);
        next();
    })
}

async function run() {
    try {
        await client.connect();

        const database = client.db("doctor_portal_13");
        const serviceCollection = database.collection("services");
        const bookingCollection = database.collection("bookings");
        const userCollection = database.collection("users");


        //All API naming convention

        //get services
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        // This is api to check whether an user is admin or not
        app.get('/admin/:email', async(req, res) =>{
            const email = req.params.email;
            const query = {email:email};
            const user = await userCollection.findOne(query);
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin});
        })

        //Check specific user by email its already in database or not...if not then insert
        app.put('/users/:email', async(req, res) =>{
            const email = req.params.email;
            const user = req.body;
            const filter = {email:email};
            const options = {upsert: true};
            const updateDoc = {
                $set:user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({email:email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
            res.send({result, token});
        })

        // Admin api
        app.put('/users/admin/:email', verifyJWT, async(req, res) =>{
            const email = req.params.email;
            const requesterEmail = req.decoded.email;
            const reqAccount = await userCollection.findOne({email: requesterEmail});
            if(reqAccount.role === 'admin'){
                const filter = {email:email};
                const updateDoc = {
                    $set:{role: 'admin'}
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else{
                res.status(403).send({message: 'Forbidden'});
            }
            
        })


        //Get all users
        app.get('/user',verifyJWT, async(req, res) =>{
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get('/available', async(req, res) =>{
            const date = req.query.date;
            // step 1: get all serevice
            const services = await serviceCollection.find().toArray();

            // step 2: get the booking of the day
            const query ={date:date};
            const bookings = await bookingCollection.find(query).toArray();

            // step 3: for each service , find booking for that service
            services.forEach(service => {
                const serviceBooking = bookings.filter(b => b.treatment === service.name);
                const booked = serviceBooking.map(s =>s.slot);
                const available = service.slots.filter(s =>!booked.includes(s));
                service.slots = available;

            })

            res.send(services);
        })

        //Get booking for particular patient using email
        app.get('/booking',verifyJWT, async(req, res) =>{
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if(patient === decodedEmail){
                // console.log(patient);
                const query ={patient:patient};
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else{
                return res.status(403).send({message:'Forbidden Access'});
            }
            
        })

        //Add Bokking to database
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = {
                treatment: booking.treatment,
                date: booking.date,
                patient: booking.patient
            };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({
                    success: false,
                    booking: exists
                });
            }
            const result = await bookingCollection.insertOne(booking);
            res.send({
                success: true,
                result
            });

        })
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World! from Doctor portal')
})

app.listen(port, () => {
    console.log(`Doctor's app listening on port ${port}`);
    //   console.log(process.env);
})