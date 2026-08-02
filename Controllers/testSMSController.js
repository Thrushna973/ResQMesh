const smsService = require("../services/smsService");

exports.testSMS = async (req,res)=>{

    await smsService.sendEmergencySMS({

        victim_name:"Rahul",

        emergency_type:"Accident",

        latitude:17.385,

        longitude:78.4867,

        message:"Major accident near highway"

    });

    res.json({

        success:true,

        message:"SMS Sent"

    });

};