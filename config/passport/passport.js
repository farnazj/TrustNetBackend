var LocalStrategy = require('passport-local').Strategy;
var models = require('../../models');
var routeHelpers = require('../../lib/routeHelpers');
var bCrypt = require('bcrypt');
// var kue = require('kue')
//  , queue = kue.createQueue();

module.exports = function(passport) {

    var User = models.Source;
    passport.use('local-signup', new LocalStrategy({
      passReqToCallback: true
      },

        function(req, username, password, done) {

            User.findOne({
              where: {
                userName: username
              }
            }).then(function(user) {

                if (user)
                {
                  return done(null, false, {
                    message: 'That username is already taken'
                  });
                }
                else {
                  User.findOne({
                     where: {
                       email: req.body.email
                     }
                   }).then(function(user) {

                    if (user && user.isVerified) {
                      return done(null, false, {
                        message: 'That email is already taken'
                        });
                    }
                    else {
                      routeHelpers.generateHash(password).then((userPassword) => {

                        let data = {
                          firstName: req.body.firstName,
                          lastName: req.body.lastName,
                          userName: username,
                          passwordHash: userPassword,
                          email: req.body.email,
                          systemMade: false,
                          photoUrl: null
                        };

                        let dataComplete = true;
                        Object.entries(data).forEach(([key, value]) => {

                          if (typeof data[key] === 'undefined' && key != "photoUrl") {
                            dataComplete = false;
                          }
                        });

                        if (!dataComplete) {
                          return done(null, false, { message: 'Request incomplete' });
                        }
                        else {

                          if (!user) {
                            User.create(data).then((newUser, created) => {

                              if (!newUser) {
                                return done(null, false, { message: 'Sth went wrong' });
                              }
                              else {
                                // queue.create('addNode', {sourceId: newUser.id}).priority('high').save();
                                return done(null, newUser, { message: 'New user created', type: 'NEW_USER' });
                              }

                            })
                          }
                          else {
                            /*
                            if user has already assessed posts externally, in which case a proxy account for them
                            already exists. Here type is USER_MERGE
                            */
                            User.create(data)
                            .then( (newUser, created) =>{
                            return done(null, newUser, { message: 'New user created', type: 'USER_MERGE' });
                            })

                          }

                        }

                      })
                    }

                   })
                }

            }).catch(function(reason) {
                return done(null, false, {message: reason});
            });

        }

    ));

    passport.serializeUser(function(user, done) {
      done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
      User.findByPk(id).then(function(user) {

        if (user) {
          done(null, user.get());
        }
        else {
            done("sth went wrong", null);
        }

      });

  });


  passport.use('local-login', new LocalStrategy({
        passReqToCallback : true
    },
    function(req, username, password, done) {
        User.findOne({where: {userName: username}}).then(function(user) {

          // if no user is found, return the message
          if (!user)
              return done(null, false, { message: 'No user found with the given username' });
          if (!user.isVerified)
              return done(null, false, {message: 'user not activated'});

          bCrypt.compare(password, user.passwordHash, (err, isValid) => {

             if (err) {
               return done(err)
             }
             if (!isValid) {
               return done(null, false, {message: 'Password not valid'});
             }
             return done(null, user);
           })

        }).catch(function(err) {
          return done(err);
        });

    }));

  };
