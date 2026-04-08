const Payment = require("../../model/payment")
const PropertyBranch = require("../../model/owner/propertyBranch")
const Expense = require("../../model/owner/expenses")
const Tenant = require("../../model/owner/tenants")

// const redisClient = require("../../utils/redis");
const mongoose = require("mongoose")





exports.getAllbranchPayments = async (req, res) => {
    try {
        const managerId = req.user._id;
        const cacheKey = `payment-${managerId}`;

        // 1️⃣ Check cache
        // if (redisClient) {
        //     const cached = await redisClient.get(cacheKey);
        //     if (cached) {
        //         return res.status(200).json({
        //             success: true,
        //             message: "Payment collection report (from cache)",
        //             allpayment: JSON.parse(cached),
        //         });
        //     }
        // }

        // 2️⃣ Get branches
        const branches = await PropertyBranch.find({ branchmanager: managerId }).select("_id");
        if (!branches.length) {
            return res.status(404).json({ success: false, message: "No branches found" });
        }
        const branchIds = branches.map(b => b._id);

        // 3️⃣ Get payments with lean query
        const allpayment = await Payment.find({ branch: { $in: branchIds } })
            .sort({ createdAt: -1 })
            .populate("tenantId", "username email")
            .populate("branch", "name city")
            .lean(); // lean reduces memory overhead

        // 4️⃣ Save cache (1 hour)
        // if (redisClient) {
        //     await redisClient.setEx(cacheKey, 3600, JSON.stringify(allpayment));
        // }

        // 5️⃣ Response
        return res.status(200).json({
            success: true,
            message: "Payment collection report",
            allpayment,
        });

    } catch (error) {
        console.error("getAllbranchPayments Error:", error);
        return res.status(500).json({
            success: false,
            message: `Server Error ${error}`,
        });
    }
};
exports.createPayment = async (req, res) => {
  try {
    const { tenantId, branch, amountpaid } = req.body;

    if (!tenantId || !branch || !amountpaid) {
      return res.status(400).json({
        success: false,
        message: "tenantId, branch and amountpaid are required"
      });
    }

    const amount = Number(amountpaid);

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount paid must be greater than 0"
      });
    }

    const foundTenant = await Tenant.findById(tenantId);
    if (!foundTenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found"
      });
    }

    let remainingAmount = amount;

    // CASE 1: No dues
    if (foundTenant.duesamount === 0) {
      foundTenant.advanced += remainingAmount;
    }

    // CASE 2: Dues > payment
    else if (foundTenant.duesamount > remainingAmount) {
      foundTenant.duesamount -= remainingAmount;
    }

    // CASE 3: Payment > dues
    else {
      remainingAmount -= foundTenant.duesamount;
      foundTenant.duesamount = 0;
      foundTenant.advanced += remainingAmount;
    }

    const payment = await Payment.create({
      tenantId,
      branch,
      email: foundTenant.email,
      amountpaid: amount,
      totalAmount: amount,
      paymentStatus: "success",
      status: "paid",
      roomNumber: foundTenant.roomNumber,
    });

    await foundTenant.save();

    return res.status(201).json({
      success: true,
      message: "Payment added successfully",
      payment
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Server Error ${error}`,
      error: error.message
    });
  }
};





exports.createExpense = async (req, res) => {

    try {


        const { category, amount, branchId } = req.body;

        if (!category || !amount || !branchId) {
            return res.status(400).json({
                success: false,
                message: "please Fill all the details"
            })
        }


        const expensecreate = await Expense.create({
            category,
            amount,
            branchId
        })
        return res.status(200).json({
            success: true,
            message: "expense created",
            expenses: expensecreate
        })


    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: `Server Error ${error}`,
        })

    }
}

exports.getAllExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find().populate("branchId"); // populate branch info if needed

        return res.status(200).json({
            success: true,
            message: "All expenses fetched successfully",
            allExpense: expenses,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: `Server Error ${error}`,
        });
    }
};



exports.RevenueDetails = async (req, res) => {
    try {
        const { month, year } = req.query;
        const userId = req.user._id;
        let notPaid = [];

        // Fetch all branches for this branch manager
        const branches = await PropertyBranch.find({ owner: userId });

        if (!branches.length) {
            return res.status(400).json({
                success: false,
                message: "No branches found for this owner",
            });
        }

        // Date range for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        let allPayments = [];
        let allExpenses = [];
        let tenantPayments = {}; // key: tenantId, value: { tenant, totalAdvance }
        let totalExpense = 0;
        let totalIncome = 0;

        for (const branch of branches) {
            // Fetch expenses
            const branchExpenses = await Expense.find({
                branchId: branch._id,
                createdAt: { $gte: startDate, $lte: endDate },
            }).populate("branchId");

            branchExpenses.forEach((exp) => {
                totalExpense += exp.amount || 0;
            });

            allExpenses.push(...branchExpenses);

            // Fetch payments
            const branchPayments = await Payment.find({
                branch: branch._id,
                createdAt: { $gte: startDate, $lte: endDate },
            })
                .sort({ createdAt: -1 })
                .populate("tenantId")
                .populate("branch");

            allPayments.push(...branchPayments);

            // Process tenant payments safely
            branchPayments.forEach((payment) => {
                const tenant = payment.tenantId;
                if (!tenant) return; // skip null tenants

                const tenantId = tenant._id.toString();
                const tenantRent = tenant.rent || 0;

                if (!tenantPayments[tenantId]) {
                    tenantPayments[tenantId] = {
                        tenant: tenant,
                        totalAdvance: payment.tilldateAdvance || 0,
                    };
                } else {
                    tenantPayments[tenantId].totalAdvance = Math.max(
                        tenantPayments[tenantId].totalAdvance,
                        payment.amountpaid || 0
                    );
                }

                tenantPayments[tenantId].totalAdvance -= tenantRent;

                // Sum income safely
                totalIncome += payment.amountpaid || 0;
            });

            // Identify tenants who haven't paid
            const allTenants = await Tenant.find({ branch: branch._id });
            const paidTenantIds = branchPayments
                .filter((p) => p.tenantId)
                .map((p) => p.tenantId._id.toString());

            allTenants.forEach((tenant) => {
                if (!paidTenantIds.includes(tenant._id.toString())) {
                    notPaid.push(tenant);
                }
            });
        }

        const totalRevenue = totalIncome - totalExpense;


        

        return res.status(200).json({
            success: true,
            message: `Payment collection report for ${month}-${year}`,
            allPayments,
            allExpenses,
            expense: totalExpense,
            income: totalIncome,
            totalRevenue,
            notPaid,
            tenantPayments,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: `Server Error ${error}`,
        });
    }
};


exports.payRent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { tenantId, amount, mode } = req.body;

        if (!tenantId || !amount || amount <= 0) {
            throw new Error("Invalid payment data");
        }

        const tenant = await Tenant.findById(tenantId).session(session);
        if (!tenant) throw new Error("Tenant not found");

        let payable = tenant.rent;
        let usedAdvance = 0;

        /* 🔥 AUTO ADJUST ADVANCE */
        if (tenant.advanced > 0) {
            usedAdvance = Math.min(tenant.advanced, payable);
            payable -= usedAdvance;
            tenant.advanced -= usedAdvance;
        }

        let paymentStatus = "paid";

        /* 🔥 PARTIAL PAYMENT LOGIC */
        if (amount < payable) {
            tenant.duesamount += payable - amount;
            tenant.duesmonth += 1;
            tenant.status = "dues";
            paymentStatus = "dues";
        } else {
            tenant.status = "paid";
        }

        tenant.lastPaidDate = new Date();

        await tenant.save({ session });

        /* 🔥 PAYMENT HISTORY */
        await Payment.create(
            [
                {
                    tenantId: tenant._id,
                    branch: tenant.branch,
                    roomNumber: tenant.roomNumber,
                    amountpaid: amount,
                    mode: mode || "offline",
                    email: tenant.email,
                    paymentForMonth: new Date().toLocaleString("default", {
                        month: "short",
                        year: "numeric"
                    }),
                    status: paymentStatus
                }
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Rent payment recorded successfully",
            data: {
                tenantId,
                amountPaid: amount,
                usedAdvance,
                status: paymentStatus
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        res.status(500).json({
            success: false,
            message: `Server Error ${error}`,
        });
    }
};
