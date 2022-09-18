const express = require('express');
const cors = require('cors');
require('dotenv').config();
const {
    MongoClient,
    ServerApiVersion
} = require('mongodb');
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

async function run() {
    try {
        await client.connect();

        const database = client.db("doctor_portal_13");
        const serviceCollection = database.collection("services");
        const bookingCollection = database.collection("bookings");


        //All API naming convention

        //get services
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
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
        app.get('/booking', async(req, res) =>{
            const patient = req.query.patient;
            // console.log(patient);
            const query ={patient:patient};
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
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