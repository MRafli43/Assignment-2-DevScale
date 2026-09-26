import 'temporal-polyfill/global'

import { Worker } from "bullmq";
import { QUEUE_NAME, workerConnection } from "./config";
import { generateAdsIdea } from "../modules/job/service";
import { db } from "../utils/db";

export const worker = new Worker(QUEUE_NAME, async (job) => {
    const jobId = job.data.id;
    if (!jobId) {
        throw new Error("Job ID is missing");
    }
    const jobData = await db.orm.public.Job.where((job) => job.id.eq(jobId),).first();
    console.log(jobData);


    if (!jobData?.product || !jobData?.media || !jobData?.category) {
        throw new Error(`Job with ID ${jobId} is missing`);
    }

    const IdeaList = await generateAdsIdea(
        jobData?.product,
        jobData?.media,
        jobData?.category,
    );

    console.log("Ads idea has generated");
    console.log(IdeaList);

    const IdeaListWithId = IdeaList.idea.map((d) => {
        return {
            jobId: jobData.id,
            title: d.title,
            description: d.description,
            cost: d.cost,
        };
    });

    await db.orm.public.JobResult.createAll(IdeaListWithId);
    await db.orm.public.Job.where((job) => job.id.eq(jobId)).update({
        status: "COMPLETED",
    });
}, {
    connection: workerConnection,
},);