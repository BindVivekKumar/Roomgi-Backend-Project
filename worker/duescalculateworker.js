const { Worker } = require("bullmq");
const Tenant = require("../model/branchmanager/tenants");
const redis = require("../utils/a"); // ioredis again



const worker = new Worker(
   "duesQueue",
   async (job) => {

      try {



         const cursor = Tenant.find({ status: "active" }).cursor();

         for (
            let tenant = await cursor.next();
            tenant != null;
            tenant = await cursor.next()
         ) {

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const fromDate = tenant.lastDuesCalculatedAt
               ? new Date(tenant.lastDuesCalculatedAt)
               : new Date(tenant.createdAt);

            fromDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor(
               (today - fromDate) / (1000 * 60 * 60 * 24)
            );


            if (diffDays <= 0) {
               continue;
            }

            let daysRemaining = diffDays;




            const rent = tenant.rent || 0;
            const onedayrent = rent / 30;

            while (daysRemaining > 0) {
               if (tenant.advanced < onedayrent) {
                  if (!tenant.startDuesFrom) tenant.startDuesFrom = today;
                  tenant.duesamount += onedayrent - tenant.advanced;
                  tenant.advanced = 0;
                  tenant.duesdays += 1;
                  if (tenant.duesdays === 30) {
                     tenant.duesmonth += 1;
                     tenant.duesdays = 0;

                  }

                  tenant.paymentStatus = "dues"




               }
               else {
                  tenant.advanced -= onedayrent;
               }



               daysRemaining--;


            }





            tenant.lastDuesCalculatedAt = today;

            await tenant.save();
         }

      } catch (error) {
         throw error;
      }
   },
   {
      connection: redis,
      concurrency: 3,
      limiter: {
         max: 10,
         duration: 1000
      }
   }
);

module.exports = worker;
