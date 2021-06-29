var express = require('express');
var router = express.Router();
var db  = require('../models');
var routeHelpers = require('../lib/routeHelpers');
var boostHelpers = require('../lib/boostHelpers');
var wrapAsync = require('../lib/wrappers').wrapAsync;
var Sequelize = require('sequelize');
const constants = require('../lib/constants');
const Op = Sequelize.Op;

// var kue = require('kue')
//  , queue = kue.createQueue();

router.route('/posts/:post_id/assessments')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let relations = await boostHelpers.getBoostersandCredSources(req);

  let post = await db.Post.findOne({
    where: { id: req.params.post_id },
    include: [
      {
        model: db.Assessment,
        as: 'PostAssessments',
        include: [{
          model: db.AssessmentReason,
          as: 'Reasons'
        }],
        where: {
          SourceId: {
            [Op.in] : relations.followedTrusteds
          }
        }
      }
    ],
    order: [
      ['PostAssessments', 'Reasons', 'Code', 'ASC' ]
    ]
  });

  res.send(post.PostAssessments);
}))


/* 
post new or update existing assessment
expects req.body of the form:
{
  postCredibility: Boolean
  sourceIsAnonymous (optional): Boolean
  reasons: Array of Objects of the type { body: String, code: Number }
}
*/

.post(wrapAsync(async function(req, res) {


  if (typeof req.user === 'undefined' && typeof req.body.assessorToken === 'undefined') {
    res.status(403).send({ message: 'User not recognized' });
  }
  else {

    let authUser;

    //for external sources that send an identifying token with their request
    if (req.body.assessorToken) {
      let token = await db.Token.findOne({
        where: {
          tokenStr: req.body.assessorToken,
          tokenType: constants.TOKEN_TYPES.OUTSIDE_SOURCE_ASSESSMENT
        },
        include: [{
          model: db.Source
        }]
      });
    
      if (!token) {
        res.status(403).send({ message: 'Source not recognized.' })
      }
      else {
        authUser = token.Source;
      }
    }
    else { //for sources that are signed up on the platform
      authUser = await db.Source.findByPk(req.user.id);
    }

    let post = await db.Post.findByPk(req.params.post_id);

    await routeHelpers.postOrUpdateAssessments({
      post: post,
      authUser: authUser,
      req: req
    })

    // queue.create('newAssessmentPosted', {postId: req.params.post_id, sourceId: req.user.id})
    // .priority('medium').removeOnComplete(true).save();
  
    res.send({ message: 'Assessment posted' });
  }

}))


router.route('/posts/:post_id/:user_id/assessment')

.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let assessments = await db.Assessment.findAll({
    where: {
      SourceId: req.params.user_id,
      PostId: req.params.post_id
    },
    include: [{
      model: db.AssessmentReason,
      as: 'Reasons'
    }],
    order: [
      [ 'version', 'DESC'],
      [ 'Reasons', 'Code', 'ASC' ]
    ]
  });

  res.send(assessments);
}));


router.route('/reason-codes')
.get(wrapAsync(async function(req, res) {
  res.send(constants.REASON_CODES_ENUM);
}));


router.route('/posts/assessments/url')
.get(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  let assessors = [];
  if (req.headers.authuser)
    assessors = [req.user.id]
  else {
    assessors = (await boostHelpers.getBoostersandCredSources(req)).followedTrusteds;
  }

  let post = await db.Post.findOne({
    where: { 
      url: req.headers.url
    },
    include: [
      {
        model: db.Assessment,
        as: 'PostAssessments',
        where: {
          SourceId: {
            [Op.in] : assessors
          }
        }
      }
    ]
  });

  let result = post ? post.PostAssessments : [];
  res.send(result);
}))

/*
posting an assessment
expects req.body of the form:
{
  url: String
  body: String,
  postCredibility: Number,
  sourceIsAnonymous (optional): Boolean,
  sourceArbiters (optional): Array of Strings
  emailArbiters (optional): Array of Strings

}
*/
.post(routeHelpers.isLoggedIn, wrapAsync(async function(req, res) {

  await routeHelpers.importPost(req.body.url);
  let post = await db.Post.findOne({
    where: { url: req.body.url }
  });  
  
  let authUser = await db.Source.findByPk(req.user.id);

  await routeHelpers.postOrUpdateAssessments({
    post: post,
    authUser: authUser,
    req: req
  });

  res.send({ message: 'Assessment posted' });

}))

module.exports = router;
